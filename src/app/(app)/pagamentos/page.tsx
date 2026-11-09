import { BellRing, ChevronLeft, ChevronRight, HandCoins, SlidersHorizontal, Wallet } from "lucide-react";
import Link from "next/link";
import BotaoLembrar from "@/components/avisos/BotaoLembrar";
import ComporAviso from "@/components/avisos/ComporAviso";
import EvolucaoMeses, { type MesResumo } from "@/components/pagamentos/EvolucaoMeses";
import FiltroLista from "@/components/pagamentos/FiltroLista";
import ResumoMes from "@/components/pagamentos/ResumoMes";
import Avatar from "@/components/ui/Avatar";
import Badge, { type Tom } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { faixasEmCache } from "@/lib/cache";
import { carregarModelosAviso, nomeCompleto, semAcento, um } from "@/lib/dados";
import { opcoesSegmento } from "@/lib/destinatarios";
import { MODALIDADES, dataBR, hojeISO, reais } from "@/lib/format";
import { ROTULO_SITUACAO, ordemSituacao, primeiroDoMes, situacaoCobranca, somarMeses, type Situacao } from "@/lib/pagamentos";
import { ajustarCobranca, darBaixa, estornarPagamento } from "./actions";

type Busca = { mes?: string; modalidade?: string; rota?: string };
const FORMAS = { pix: "PIX", transferencia: "Transferência (Papayas)", debito_automatico: "Débito automático", dinheiro: "Dinheiro", outro: "Outro" };
const TOM_SIT: Record<Situacao, Tom> = { em_dia: "verde", a_vencer: "azul", vence_hoje: "ambar", atrasado: "laranja", atraso_critico: "vermelho", sem_cobranca: "cinza" };

export default async function Pagamentos({ searchParams }: { searchParams: Promise<Busca> }) {
  const { supabase, usuario } = await exigirEquipe();
  const b = await searchParams;
  const hoje = hojeISO();
  const mes = /^\d{4}-\d{2}$/.test(b.mes ?? "") ? `${b.mes}-01` : primeiroDoMes(hoje);

  // Só gera o mês atual e o próximo: meses passados nunca nascem sozinhos
  // (criariam atrasos falsos para quem cadastrou assinatura antiga).
  const atual = primeiroDoMes(hoje);
  const gera = mes >= atual && mes <= somarMeses(atual, 1);
  const buscaCobrancas = () => supabase
    .from("cobrancas")
    .select("id, valor_centavos, vencimento, status, justificativa, assinaturas(cliente_id, clientes(nome, sobrenome, whatsapp, email), planos(nome, modalidade)), pagamentos(id, valor_centavos, data, forma, observacao)")
    .eq("competencia", mes)
    .order("vencimento");

  // A geração é idempotente e barata; roda junto com as demais consultas, e depois relemos só se algo nasceu.
  const [{ data: cobrancasInicial }, { data: rotas }, { data: atrib }, faixas, gerou, { data: serie }, opcoesAviso, modelosAviso] = await Promise.all([
    buscaCobrancas(),
    supabase.from("rotas").select("id, nome").order("nome"),
    supabase.from("atribuicoes_rota").select("cliente_id, rota_id").is("fim", null),
    faixasEmCache(),
    gera ? supabase.rpc("gerar_cobrancas", { p_competencia: mes }) : Promise.resolve({ data: 0 }),
    supabase.rpc("resumo_cobrancas", { p_ini: somarMeses(mes, -5), p_fim: mes }),
    opcoesSegmento(supabase, { rotas: [] }),
    carregarModelosAviso(supabase),
  ]);
  const cobrancas = Number(gerou.data) > 0 ? (await buscaCobrancas()).data : cobrancasInicial;
  const rotaDe = new Map((atrib ?? []).map((a) => [a.cliente_id, a.rota_id]));

  const linhas = (cobrancas ?? [])
    .map((c) => {
      const a = um(c.assinaturas as never) as { cliente_id: string; clientes: never; planos: never } | null;
      const cli = um(a?.clientes) as { nome: string; sobrenome: string; whatsapp: string | null; email: string | null } | null;
      const plano = um(a?.planos) as { nome: string; modalidade: keyof typeof MODALIDADES } | null;
      const pagos = (c.pagamentos as { id: string; valor_centavos: number; data: string; forma: keyof typeof FORMAS; observacao: string | null }[]) ?? [];
      const pago = pagos.reduce((s, p) => s + p.valor_centavos, 0);
      return { c, a, cli, plano, pagos, pago, restante: Math.max(c.valor_centavos - pago, 0), sit: situacaoCobranca(c, hoje, faixas) };
    })
    .filter((l) => !b.modalidade || l.plano?.modalidade === b.modalidade)
    .filter((l) => !b.rota || rotaDe.get(l.a?.cliente_id ?? "") === b.rota)
    ;

  const ativas = linhas.filter((l) => l.c.status !== "isenta" && l.c.status !== "cancelada");
  const esperado = ativas.reduce((s, l) => s + l.c.valor_centavos, 0);
  const recebido = linhas.reduce((s, l) => s + l.pago, 0);
  const atrasadas = ativas.filter((l) => l.sit === "atrasado" || l.sit === "atraso_critico");
  const emAtraso = atrasadas.reduce((s, l) => s + l.restante, 0);
  const aReceber = Math.max(esperado - recebido, 0);
  const qtdRecebidas = ativas.filter((l) => l.restante === 0).length;

  // série dos últimos 6 meses; meses sem cobrança entram zerados para a escala ficar honesta
  type LinhaSerie = { competencia: string; esperado: number; recebido: number };
  const porMes = new Map<string, LinhaSerie>(((serie ?? []) as LinhaSerie[]).map((m) => [m.competencia, m]));
  const meses: MesResumo[] = [-5, -4, -3, -2, -1, 0].map((d) => {
    const c = somarMeses(mes, d);
    const m = porMes.get(c);
    return { competencia: c, esperado: Number(m?.esperado ?? 0), recebido: Number(m?.recebido ?? 0) };
  });

  const grupos = ordemSituacao.map((s) => ({ s, itens: linhas.filter((l) => l.sit === s) })).filter((g) => g.itens.length);
  const conta = (f: (s: Situacao) => boolean) => linhas.filter((l) => f(l.sit)).length;
  const chips = [
    { chave: "todas", rotulo: "Todas", qtd: linhas.length },
    { chave: "atrasados", rotulo: "Em atraso", qtd: conta((s) => s === "atrasado" || s === "atraso_critico") },
    { chave: "vence_hoje", rotulo: "Vence hoje", qtd: conta((s) => s === "vence_hoje") },
    { chave: "a_vencer", rotulo: "A vencer", qtd: conta((s) => s === "a_vencer") },
    { chave: "em_dia", rotulo: "Em dia", qtd: conta((s) => s === "em_dia") },
  ].filter((c) => c.chave === "todas" || c.qtd > 0);
  const mesParam = (m: string) => `/pagamentos?mes=${m.slice(0, 7)}`;
  const nomeMes = new Date(`${mes}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader
        titulo={nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}
        subtitulo="Mensalidades geradas a partir das assinaturas. Quem está em atraso sai das rotas até pagar."
        acoes={<>
          <div className="flex items-center rounded-xl border border-stone-200 bg-white p-0.5 shadow-sm">
            <Link className="btn-ghost !p-2" href={mesParam(somarMeses(mes, -1))} aria-label="Mês anterior"><ChevronLeft size={17} /></Link>
            <Link className="btn-ghost !px-3" href="/pagamentos">Hoje</Link>
            <Link className="btn-ghost !p-2" href={mesParam(somarMeses(mes, 1))} aria-label="Próximo mês"><ChevronRight size={17} /></Link>
          </div>
          <Modal titulo="Avisar clientes pelo app" descricao="A notificação chega no aplicativo Amada Massa. Use {nome}, {valor} e {vencimento} para personalizar." gatilho={<><BellRing size={16} />Avisar pelo app</>} gatilhoClasse="btn" largo>
            <ComporAviso compacto opcoes={opcoesAviso.filter((o) => ["todos", "atrasados", "pendentes"].includes(o.codigo))} modelos={modelosAviso} segmentoInicial={atrasadas.length ? "atrasados" : "todos"} />
          </Modal>
        </>}
      />

      <div className="mb-5 grid items-stretch gap-4 xl:grid-cols-[1.35fr_1fr]">
        <ResumoMes esperado={esperado} recebido={recebido} aReceber={aReceber} emAtraso={emAtraso} cobrancas={ativas.length} qtdRecebidas={qtdRecebidas} qtdAtraso={atrasadas.length} />
        <EvolucaoMeses meses={meses} atual={mes.slice(0, 7) + "-01"} />
      </div>

      <FiltroLista
        alvo="#lista-pagamentos" chips={chips} mes={mes.slice(0, 7)} modalidade={b.modalidade} rota={b.rota}
        modalidades={Object.entries(MODALIDADES).map(([valor, rotulo]) => ({ valor, rotulo }))}
        rotas={(rotas ?? []).map((r) => ({ valor: r.id, rotulo: r.nome }))}
      />

      {!grupos.length && (
        <div className="cartao"><Vazio icone={Wallet} titulo="Nenhuma cobrança neste mês" texto="As cobranças nascem das assinaturas ativas. Cadastre clientes com plano para gerá-las." /></div>
      )}

      <div id="lista-pagamentos" className="flex flex-col gap-5">
        {grupos.map(({ s, itens }) => (
          <section key={s} data-grupo={s} className="cartao overflow-hidden !p-0">
            <h2 className="flex items-center gap-2 border-b border-stone-100 px-5 py-3 text-sm font-semibold">
              <Badge tom={TOM_SIT[s]} ponto>{ROTULO_SITUACAO[s]}</Badge>
              <span className="text-stone-400"><span data-n>{itens.length}</span> {itens.length === 1 ? "cobrança" : "cobranças"} · {reais(itens.reduce((t, l) => t + l.restante, 0))} a receber</span>
            </h2>
            <table className="tabela table-fixed">
              <colgroup><col className="w-[30%]" /><col className="w-[20%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[20%]" /></colgroup>
              <thead><tr><th>Cliente</th><th>Plano</th><th>Vencimento</th><th>Valor</th><th>Ações</th></tr></thead>
              <tbody>
                {itens.map(({ c, cli, plano, pagos, pago, restante, a }) => {
                  const nm = nomeCompleto(cli);
                  return (
                    <tr key={c.id} data-sit={s} data-fone={(cli?.whatsapp ?? "").replace(/\D/g, "")}
                      data-busca={semAcento(`${nm} ${cli?.email ?? ""} ${plano?.nome ?? ""} ${plano ? MODALIDADES[plano.modalidade] : ""} ${(c.valor_centavos / 100).toFixed(2).replace(".", ",")}`)}>
                      <td><Link href={`/clientes/${a?.cliente_id}`} className="flex items-center gap-3"><Avatar nome={nm} tamanho={32} /><span className="font-medium">{nm}</span></Link></td>
                      <td className="text-stone-600">{plano ? MODALIDADES[plano.modalidade] : "—"}<span className="block text-xs text-stone-400">{plano?.nome.split("·")[1]?.trim()}</span></td>
                      <td>{dataBR(c.vencimento)}{c.justificativa && <span className="block text-xs text-stone-400">{c.justificativa}</span>}</td>
                      <td><b>{reais(c.valor_centavos)}</b>{pago > 0 && pago < c.valor_centavos && <span className="block text-xs text-emerald-700">pago {reais(pago)}</span>}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {c.status === "pendente" && (
                            <Modal titulo="Dar baixa" descricao={`${nm} · ${reais(restante)} em aberto`} gatilho={<><HandCoins size={15} />Dar baixa</>} gatilhoClasse="btn btn-pequeno">
                              <form action={darBaixa} className="flex flex-col gap-4">
                                <input type="hidden" name="cobranca_id" value={c.id} />
                                <div className="grid grid-cols-2 gap-3">
                                  <div><label className="rotulo">Valor recebido (R$)</label><input className="campo" name="valor" defaultValue={(restante / 100).toFixed(2).replace(".", ",")} required /></div>
                                  <div><label className="rotulo">Data</label><input className="campo" type="date" name="data" defaultValue={hoje} /></div>
                                </div>
                                <div><label className="rotulo">Forma de pagamento</label><select className="campo" name="forma">{Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                                <div><label className="rotulo">Observação</label><input className="campo" name="observacao" placeholder="Opcional" /></div>
                                <div className="flex justify-end"><SubmitButton>Confirmar pagamento</SubmitButton></div>
                              </form>
                            </Modal>
                          )}
                          {c.status === "paga" && <span className="mr-1 text-xs text-emerald-700">Paga {pagos[0] && dataBR(pagos[0].data)}</span>}
                          {c.status === "pendente" && (
                            <BotaoLembrar cobrancaId={c.id} nome={nm} />
                          )}
                          <Modal titulo="Ajustes da cobrança" descricao={`${nm} · ${reais(c.valor_centavos)} · vence ${dataBR(c.vencimento)}`} gatilho={<SlidersHorizontal size={16} />} gatilhoClasse="btn-ghost !p-2">
                            <div className="flex flex-col gap-5">
                              {pagos.length > 0 && (
                                <div>
                                  <div className="rotulo">Pagamentos registrados</div>
                                  <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 text-sm">
                                    {pagos.map((p) => (
                                      <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                                        <span className="flex-1">{dataBR(p.data)} · {reais(p.valor_centavos)} · {FORMAS[p.forma]}{p.observacao && ` · ${p.observacao}`}</span>
                                        {usuario.perfil === "admin" && (
                                          <form action={estornarPagamento}><input type="hidden" name="pagamento_id" value={p.id} /><input type="hidden" name="cobranca_id" value={c.id} /><SubmitButton className="btn-perigo btn-pequeno">Estornar</SubmitButton></form>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <form action={ajustarCobranca} className="flex flex-col gap-3">
                                <input type="hidden" name="cobranca_id" value={c.id} />
                                <div className="grid grid-cols-3 gap-3">
                                  <div><label className="rotulo">Novo valor</label><input className="campo" name="valor" placeholder="R$" /></div>
                                  <div className="col-span-2"><label className="rotulo">Justificativa (obrigatória)</label><input className="campo" name="justificativa" placeholder="Ex.: desconto combinado" /></div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <SubmitButton className="btn-sec btn-pequeno" name="acao" value="valor">Ajustar valor</SubmitButton>
                                  <SubmitButton className="btn-sec btn-pequeno" name="acao" value="isentar">Isentar no mês</SubmitButton>
                                  {c.status === "pendente" && <SubmitButton className="btn-perigo btn-pequeno" name="acao" value="cancelar">Cancelar cobrança</SubmitButton>}
                                  {c.status !== "pendente" && <SubmitButton className="btn-sec btn-pequeno" name="acao" value="reabrir" formNoValidate>Reabrir</SubmitButton>}
                                </div>
                              </form>
                            </div>
                          </Modal>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}
