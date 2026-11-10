import {
  Ban, Bell, HeartHandshake, CalendarClock, Check, FileDown, History, MapPin, Pause, Pencil, Play, Plus, Repeat, Trash2, Truck, Wallet,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge, { type Tom } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirEquipe } from "@/lib/auth";
import { faixasEmCache } from "@/lib/cache";
import { carregarModelosAviso, nomeCompleto, um } from "@/lib/dados";
import ComporAviso from "@/components/avisos/ComporAviso";
import { chaveTelefone } from "@/lib/telefone";
import { CANAIS, MODALIDADES, STATUS_CLIENTE, dataBR, hojeISO, reais } from "@/lib/format";
import { ROTULO_SITUACAO, situacaoCobranca, type Situacao } from "@/lib/pagamentos";
import { STATUS_ENTREGA } from "@/lib/semana";
import { concluirContato, excluirCliente, mudarStatus, registrarContato } from "../actions";
import TrocarPlanoForm from "./TrocarPlanoForm";

const TOM_SIT: Record<Situacao, Tom> = { em_dia: "verde", a_vencer: "azul", vence_hoje: "ambar", atrasado: "laranja", atraso_critico: "vermelho", sem_cobranca: "cinza" };
const TOM_STATUS: Record<string, Tom> = { ativo: "verde", pausado: "ambar", cancelado: "cinza" };
const TOM_ENTREGA: Record<string, Tom> = { entregue: "verde", retirada: "verde", nao_entregue: "vermelho", suspensa_atraso: "laranja", pulada: "cinza", programada: "azul", reagendada: "ambar" };

const Linha = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <div className="flex gap-3 py-2 text-sm"><dt className="w-28 shrink-0 text-stone-500">{rotulo}</dt><dd className="min-w-0 flex-1 text-stone-900">{children}</dd></div>
);

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, usuario } = await exigirEquipe();
  const hoje = hojeISO();

  const [{ data: c }, { data: assinaturas }, { data: contatos }, { data: planos }, { data: pontos }, { data: entregas }, { data: membro }, { count: aparelhos }, { data: atrib }, faixas, { data: cobrancas }, modelosAviso] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("assinaturas").select("*, planos(nome, modalidade, paes_por_semana, valor_centavos), pontos_coleta(nome)").eq("cliente_id", id).order("inicio", { ascending: false }),
    supabase.from("contatos").select("*").eq("cliente_id", id).order("data", { ascending: false }).order("criado_em", { ascending: false }),
    supabase.from("planos").select("id, nome, modalidade, paes_por_semana, valor_centavos").eq("ativo", true).order("valor_centavos"),
    supabase.from("pontos_coleta").select("id, nome, tipo, endereco, horario_texto").eq("ativo", true).order("nome"),
    supabase.from("entregas").select("id, status, ocorrencia, rota_nome, ponto_nome, semanas(inicio, sabor)").eq("cliente_id", id).order("semana_id", { ascending: false }).limit(8),
    supabase.from("membros").select("criado_em").eq("cliente_id", id).maybeSingle(),
    supabase.from("push_inscricoes").select("*", { count: "exact", head: true }).eq("cliente_id", id),
    supabase.from("atribuicoes_rota").select("rotas(nome, cor)").eq("cliente_id", id).is("fim", null).maybeSingle(),
    faixasEmCache(),
    supabase.from("cobrancas").select("id, competencia, valor_centavos, vencimento, status, assinaturas!inner(cliente_id)").eq("assinaturas.cliente_id", id).order("competencia", { ascending: false }).limit(8),
    carregarModelosAviso(supabase),
  ]);
  if (!c) notFound();

  const atual = assinaturas?.find((a) => a.status === "ativa" || a.status === "pausada");
  const planoAtual = um(atual?.planos as never) as { nome: string; modalidade: keyof typeof MODALIDADES; paes_por_semana: number; valor_centavos: number } | null;
  const pontoAtual = um(atual?.pontos_coleta as never) as { nome: string } | null;
  const rota = um(atrib?.rotas as never) as { nome: string; cor: string } | null;
  const nome = nomeCompleto(c);
  const endereco = [c.logradouro && `${c.logradouro}${c.numero ? ", " + c.numero : ""}`, c.complemento, c.bairro].filter(Boolean).join(" · ");

  const cobMes = cobrancas?.find((b) => b.competencia === `${hoje.slice(0, 7)}-01`) ?? cobrancas?.[0];
  const sit = cobMes ? situacaoCobranca(cobMes, hoje, faixas) : null;
  const proximo = contatos?.find((k) => k.proximo_passo && !k.concluido);

  type Evento = { data: string; titulo: string; detalhe?: string; tom: string };
  const eventos: Evento[] = [
    ...(contatos ?? []).map((k) => ({ data: k.data, titulo: `Contato por ${CANAIS[k.canal as keyof typeof CANAIS]}`, detalhe: k.resumo, tom: "bg-sky-500" })),
    ...(assinaturas ?? []).flatMap((a) => {
      const p = um(a.planos as never) as { nome: string } | null;
      const e: Evento[] = [{ data: a.inicio, titulo: "Assinatura iniciada", detalhe: `${p?.nome} · ${reais(a.valor_centavos)}/mês`, tom: "bg-emerald-500" }];
      if (a.fim) e.push({ data: a.fim, titulo: a.status === "encerrada" ? "Plano trocado" : "Assinatura cancelada", detalhe: a.motivo_cancelamento ?? undefined, tom: "bg-stone-400" });
      return e;
    }),
  ].sort((x, y) => y.data.localeCompare(x.data));

  return (
    <>
      <PageHeader
        voltar={{ href: "/clientes", rotulo: "Clientes" }}
        titulo={<span className="flex items-center gap-3"><Avatar nome={nome} tamanho={44} />{nome}</span>}
        etiqueta={<Badge tom={TOM_STATUS[c.status]} ponto>{STATUS_CLIENTE[c.status as keyof typeof STATUS_CLIENTE]}</Badge>}
        subtitulo={<>
          {c.status === "pausado" && c.pausa_retorno_previsto && `Retorno previsto em ${dataBR(c.pausa_retorno_previsto)} · `}
          {c.status === "cancelado" && `Cancelado em ${dataBR(c.cancelado_em)} (${c.motivo_cancelamento}) · `}
          Cliente desde {dataBR(c.confirmado_em)}
        </>}
        acoes={<>
          <Modal titulo="Avisar pelo app" descricao={`Notificação para ${nomeCompleto(c)} no aplicativo Amada Massa.`} gatilho={<><Bell size={16} />Avisar pelo app</>} gatilhoClasse="btn">
            <ComporAviso compacto fixo={{ codigo: `clientes:${id}`, rotulo: nomeCompleto(c) }} opcoes={[]} modelos={modelosAviso} />
          </Modal>
          <Modal titulo="Registrar contato" descricao="Fica na linha do tempo do cliente." gatilho={<><Plus size={16} />Contato</>}>
            <form action={registrarContato} className="flex flex-col gap-4">
              <input type="hidden" name="cliente_id" value={id} />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="rotulo">Canal</label><select className="campo" name="canal">{Object.entries(CANAIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="rotulo">Data</label><input className="campo" type="date" name="data" defaultValue={hoje} /></div>
              </div>
              <div><label className="rotulo">O que foi combinado</label><textarea className="campo" name="resumo" rows={3} required placeholder="Resumo do contato" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="rotulo">Próximo passo</label><input className="campo" name="proximo_passo" placeholder="Opcional" /></div>
                <div><label className="rotulo">Para quando</label><input className="campo" type="date" name="proximo_passo_em" /></div>
              </div>
              <div className="flex justify-end"><SubmitButton>Salvar contato</SubmitButton></div>
            </form>
          </Modal>
          <Link className="btn-sec" href={`/clientes/${id}/editar`}><Pencil size={15} />Editar</Link>
        </>}
      />

      {proximo && (
        <form action={concluirContato} className="mb-5 flex items-center gap-3 rounded-xl bg-amber-50 shadow-sm px-4 py-3 text-sm text-amber-950">
          <input type="hidden" name="id" value={proximo.id} /><input type="hidden" name="cliente_id" value={id} />
          <CalendarClock size={18} className="shrink-0" />
          <span className="flex-1"><b>Próximo passo:</b> {proximo.proximo_passo} {proximo.proximo_passo_em && <span className="text-amber-800">· {dataBR(proximo.proximo_passo_em)}</span>}</span>
          <SubmitButton className="btn-sec btn-pequeno"><Check size={14} />Concluir</SubmitButton>
        </form>
      )}

      <div className="grid grid-cols-[1fr_340px] items-start gap-5">
        <div className="flex flex-col gap-5">
          {/* A assinatura: onde cliente e plano se encontram */}
          <section className="cartao">
            <div className="cartao-titulo"><Repeat size={17} className="text-stone-400" />Assinatura
              <span className="ml-1 text-sm font-normal text-stone-500">o plano que este cliente contratou</span></div>
            {atual && planoAtual ? (
              <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  {planoAtual.modalidade === "entrega" ? <Truck size={22} /> : planoAtual.modalidade === "apoio" ? <HeartHandshake size={22} /> : <MapPin size={22} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{planoAtual.nome}</div>
                  <div className="text-sm text-stone-600">
                    {planoAtual.modalidade === "apoio" ? <>Contribuição mensal, sem pães</> : planoAtual.modalidade === "entrega" ? (rota ? <>Entrega pela <b style={{ color: rota.cor }}>{rota.nome}</b></> : <span className="text-amber-800">Entrega, ainda sem rota</span>) : <>Retira em <b>{pontoAtual?.nome}</b></>}
                    {" · "}vence todo dia {atual.dia_vencimento}
                  </div>
                  {planoAtual.paes_por_semana > 0 && <div className="mt-0.5 text-xs text-stone-500">{planoAtual.paes_por_semana} {planoAtual.paes_por_semana > 1 ? "pães" : "pão"} por semana</div>}
                  {atual.justificativa_valor && <div className="text-xs text-stone-500">Valor diferente do catálogo: {atual.justificativa_valor}</div>}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tracking-tight">{reais(atual.valor_centavos)}</div>
                  <div className="text-xs text-stone-500">por mês{atual.valor_centavos !== planoAtual.valor_centavos && ` (catálogo ${reais(planoAtual.valor_centavos)})`}</div>
                </div>
              </div>
            ) : <p className="text-sm text-stone-500">Sem assinatura ativa.</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {atual && (
                <Modal titulo="Trocar de plano" descricao="Encerra a assinatura atual e cria outra. O histórico é mantido." gatilho={<><Repeat size={15} />Trocar plano</>} gatilhoClasse="btn-sec btn-pequeno" largo>
                  <TrocarPlanoForm clienteId={id} assinaturaId={atual.id} planoAtualId={atual.plano_id} pontoAtualId={atual.ponto_coleta_id} planos={(planos ?? []) as never} pontos={(pontos ?? []) as never} hoje={hoje} />
                </Modal>
              )}
              {c.status === "ativo" && (
                <Modal titulo="Pausar assinatura" descricao="Sem cobrança nem entrega enquanto estiver pausado." gatilho={<><Pause size={15} />Pausar</>} gatilhoClasse="btn-sec btn-pequeno">
                  <form action={mudarStatus} className="flex flex-col gap-4">
                    <input type="hidden" name="cliente_id" value={id} /><input type="hidden" name="acao" value="pausar" />
                    <div><label className="rotulo">Previsão de retorno</label><input className="campo" type="date" name="retorno" /></div>
                    <div className="flex justify-end"><SubmitButton>Pausar</SubmitButton></div>
                  </form>
                </Modal>
              )}
              {c.status !== "ativo" && c.status !== "cancelado" && (
                <form action={mudarStatus}><input type="hidden" name="cliente_id" value={id} /><input type="hidden" name="acao" value="reativar" />
                  <SubmitButton className="btn btn-pequeno"><Play size={14} />Reativar</SubmitButton></form>
              )}
              {c.status === "cancelado" && (
                <form action={mudarStatus}><input type="hidden" name="cliente_id" value={id} /><input type="hidden" name="acao" value="reativar" />
                  <SubmitButton className="btn btn-pequeno"><Play size={14} />Reativar cliente</SubmitButton></form>
              )}
              {c.status !== "cancelado" && (
                <Modal titulo="Cancelar assinatura" descricao="O cliente não é apagado: muda de status e o histórico fica." gatilho={<><Ban size={15} />Cancelar assinatura</>} gatilhoClasse="btn-perigo btn-pequeno">
                  <form action={mudarStatus} className="flex flex-col gap-4">
                    <input type="hidden" name="cliente_id" value={id} /><input type="hidden" name="acao" value="cancelar" />
                    <div><label className="rotulo">Motivo</label>
                      <input className="campo" name="motivo" list="motivos" required placeholder="Escolha ou digite" />
                      <datalist id="motivos">{["preço", "mudança de cidade", "sabor", "logística", "outro"].map((m) => <option key={m} value={m} />)}</datalist></div>
                    <div><label className="rotulo">Vale a partir de</label><input className="campo" type="date" name="data" defaultValue={hoje} /></div>
                    <div className="flex justify-end"><SubmitButton className="btn-perigo">Cancelar assinatura</SubmitButton></div>
                  </form>
                </Modal>
              )}
            </div>
            {assinaturas && assinaturas.length > 1 && (
              <div className="mt-4 border-t border-stone-100 pt-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400"><History size={13} />Planos anteriores</div>
                <ul className="text-sm text-stone-600">
                  {assinaturas.filter((a) => a !== atual).map((a) => (
                    <li key={a.id} className="flex gap-2 py-0.5"><span className="flex-1">{(um(a.planos as never) as { nome: string } | null)?.nome}</span><span className="text-stone-400">{dataBR(a.inicio)} → {dataBR(a.fim)}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="cartao">
            <div className="cartao-titulo"><Wallet size={17} className="text-stone-400" />Pagamentos
              {sit && <span className="ml-1"><Badge tom={TOM_SIT[sit]} ponto>{ROTULO_SITUACAO[sit]}</Badge></span>}
              <Link className="link ml-auto text-sm" href="/pagamentos">Abrir pagamentos</Link></div>
            {cobrancas?.length ? (
              <table className="tabela -mx-1">
                <thead><tr><th>Mês</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead>
                <tbody>
                  {cobrancas.map((b) => {
                    const s = situacaoCobranca(b, hoje, faixas);
                    return (
                      <tr key={b.id}>
                        <td className="font-medium">{b.competencia.slice(5, 7)}/{b.competencia.slice(0, 4)}</td>
                        <td className="text-stone-600">{dataBR(b.vencimento)}</td><td>{reais(b.valor_centavos)}</td>
                        <td><Badge tom={TOM_SIT[s]} ponto>{b.status === "paga" ? "Paga" : ROTULO_SITUACAO[s]}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p className="text-sm text-stone-500">Nenhuma cobrança gerada ainda.</p>}
          </section>

          <section className="cartao">
            <div className="cartao-titulo"><History size={17} className="text-stone-400" />Linha do tempo</div>
            {eventos.length ? (
              <ol className="relative ml-1.5 border-l border-stone-200">
                {eventos.map((e, i) => (
                  <li key={i} className="relative pb-5 pl-6 last:pb-0">
                    <span className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-white ${e.tom}`} />
                    <div className="flex items-baseline gap-2"><span className="text-sm font-medium">{e.titulo}</span><span className="text-xs text-stone-400">{dataBR(e.data)}</span></div>
                    {e.detalhe && <p className="text-sm text-stone-600">{e.detalhe}</p>}
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-stone-500">Nada registrado ainda.</p>}
          </section>

          <section className="cartao">
            <div className="cartao-titulo"><Truck size={17} className="text-stone-400" />Entregas recentes</div>
            {entregas?.length ? (
              <ul className="divide-y divide-stone-100">
                {entregas.map((e) => {
                  const sm = um(e.semanas as never) as { inicio: string; sabor: string | null } | null;
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="w-24 text-stone-500">{dataBR(sm?.inicio)}</span>
                      <span className="flex-1">{sm?.sabor ?? "—"} <span className="text-stone-400">· {e.rota_nome ?? e.ponto_nome ?? "—"}</span></span>
                      <Badge tom={TOM_ENTREGA[e.status]}>{STATUS_ENTREGA[e.status]}{e.ocorrencia && ` · ${e.ocorrencia}`}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-stone-500">Sem entregas registradas.</p>}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="cartao">
            <div className="cartao-titulo">Contato</div>
            <dl className="-my-1 divide-y divide-stone-100">
              <Linha rotulo="WhatsApp">{c.whatsapp ?? "—"}</Linha>
              <Linha rotulo="E-mail">{c.email ?? "—"}</Linha>
              <Linha rotulo="Endereço">{endereco || "—"}</Linha>
              {c.referencia_portaria && <Linha rotulo="Portaria">{c.referencia_portaria}</Linha>}
              {c.instrucoes_entrega && <Linha rotulo="Instruções">{c.instrucoes_entrega}</Linha>}
              <Linha rotulo="Origem">{c.origem ?? "—"}</Linha>
              {c.restricoes_alimentares && <Linha rotulo="Restrições">{c.restricoes_alimentares}</Linha>}
              {c.observacoes && <Linha rotulo="Observações">{c.observacoes}</Linha>}
            </dl>
          </section>

          <section className="cartao">
            <div className="cartao-titulo"><Bell size={16} className="text-stone-400" />App do membro</div>
            <p className="text-sm">
              {!c.email || !chaveTelefone(c.whatsapp) ? <span className="text-amber-800">Falta {!c.email ? "e-mail" : "telefone com DDD"} no cadastro: o cliente só entra no app com e-mail e telefone.</span>
                : !membro ? <span className="text-stone-600">Ainda não entrou no app.</span>
                : aparelhos ? <span className="text-emerald-700">Recebe avisos em {aparelhos} aparelho{aparelhos > 1 ? "s" : ""}.</span>
                : <span className="text-stone-600">Entrou, mas não ativou os avisos.</span>}
            </p>
          </section>

          {usuario.perfil === "admin" && (
            <section className="cartao ">
              <div className="cartao-titulo text-red-800">LGPD</div>
              <div className="flex flex-col gap-2">
                <a className="btn-sec btn-pequeno justify-start" href={`/clientes/${id}/exportar`}><FileDown size={15} />Exportar dados (JSON)</a>
                <Modal titulo="Excluir definitivamente" descricao="Apaga o cliente e todo o histórico. Não dá para desfazer." gatilho={<><Trash2 size={15} />Excluir cliente</>} gatilhoClasse="btn-perigo btn-pequeno justify-start">
                  <form action={excluirCliente} className="flex flex-col gap-4">
                    <input type="hidden" name="cliente_id" value={id} />
                    <div><label className="rotulo">Digite EXCLUIR para confirmar</label><input className="campo" name="confirmacao" required autoComplete="off" /></div>
                    <div className="flex justify-end"><SubmitButton className="btn-perigo">Excluir definitivamente</SubmitButton></div>
                  </form>
                </Modal>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
