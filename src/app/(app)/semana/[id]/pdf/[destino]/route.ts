import { exigirEquipe } from "@/lib/auth";
import { DIAS_CURTO } from "@/lib/horarios";
import { gerarPdf, type ColunaPdf, type DocPdf } from "@/lib/pdf";
import { carregarSemanaCompleta, estaAtiva, type Grupo, type SemanaCompleta } from "@/lib/planejamento";
import { hojeISO } from "@/lib/format";

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const telefone = (t: string | null) => {
  const d = (t ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t ?? "";
};

function colunasPaes(dados: SemanaCompleta): ColunaPdf[] {
  return dados.paes.map((p) => ({ titulo: p.nome, peso: 1.1, alinhar: "centro" as const }));
}
const levar = (dados: SemanaCompleta, totais: Record<string, number>) => dados.paes.map((p) => ({ nome: p.nome, qtd: totais[p.id] ?? 0 }));

/** PDF de produção: quanto produzir de cada pão e para onde vai. */
function docProducao(dados: SemanaCompleta): DocPdf {
  const { semana: s } = dados;
  return {
    titulo: "Produção da semana",
    subtitulo: dados.paes.length ? dados.paes.map((p) => p.nome).join(" · ") : "Pães ainda não definidos",
    info: [["Semana", `${dm(s.inicio)} a ${dm(s.fim)}`], ["Clientes", String(dados.clientes)]],
    levar: levar(dados, dados.totaisPorPao), totalPaes: dados.totalPaes,
    colunas: [{ titulo: "Destino", peso: 3.2 }, { titulo: "Tipo", peso: 1.2 }, { titulo: "Clientes", peso: 0.9, alinhar: "centro" }, ...colunasPaes(dados), { titulo: "Total", peso: 0.8, alinhar: "centro" }],
    linhas: dados.grupos.map((g) => [g.chave === "rota:sem" ? "Entrega sem rota" : g.nome, g.tipo === "entrega" ? "Entrega" : g.tipo === "padaria" ? "Padaria" : "Ponto de coleta", String(g.ativos), ...dados.paes.map((p) => String(g.totais[p.id] ?? 0)), String(g.totalPaes)]),
    totais: ["Total", "", String(dados.clientes), ...dados.paes.map((p) => String(dados.totaisPorPao[p.id] ?? 0)), String(dados.totalPaes)],
    rodape: `Produção ${dm(s.inicio)}`,
  };
}

/** PDF de retirada (ponto de coleta ou padaria): quanto levar e a lista para conferir quem retirou. */
function docRetirada(dados: SemanaCompleta, g: Grupo, endereco: string, horario: string): DocPdf {
  const linhas = g.linhas.filter((l) => estaAtiva(l.status));
  const { semana: s } = dados;
  return {
    titulo: `${g.tipo === "padaria" ? "Retirada na padaria" : "Retirada"} — ${g.nome}`,
    subtitulo: [endereco, horario].filter(Boolean).join(" · "),
    info: [["Semana", `${dm(s.inicio)} a ${dm(s.fim)}`], ["Clientes", String(g.ativos)]],
    levar: levar(dados, g.totais), totalPaes: g.totalPaes,
    colunas: [
      { titulo: "#", peso: 0.45, alinhar: "centro" }, { titulo: "Cliente", peso: 3 }, { titulo: "Telefone", peso: 1.7 },
      ...colunasPaes(dados), { titulo: "Total", peso: 0.8, alinhar: "centro" },
      { titulo: "Retirou", peso: 0.9, alinhar: "centro", tipo: "caixa" }, { titulo: "Assinatura", peso: 2.2, tipo: "linha" },
    ],
    linhas: linhas.map((l, i) => [String(i + 1), l.nome, telefone(l.whatsapp), ...dados.paes.map((p) => String(l.quantidades[p.id] ?? 0)), String(l.qtd), "", ""]),
    totais: ["", "Total", "", ...dados.paes.map((p) => String(g.totais[p.id] ?? 0)), String(g.totalPaes), "", ""],
    rodape: `Retirada ${g.nome}`,
  };
}

/** PDF de entrega (rota): paradas na ordem, com endereço e o que levar a cada cliente. */
function docEntrega(dados: SemanaCompleta, g: Grupo): DocPdf {
  const linhas = g.linhas.filter((l) => estaAtiva(l.status));
  const { semana: s } = dados;
  return {
    titulo: `Entrega — ${g.chave === "rota:sem" ? "clientes sem rota" : g.nome}`,
    subtitulo: "Paradas na ordem de entrega",
    info: [["Semana", `${dm(s.inicio)} a ${dm(s.fim)}`], ["Paradas", String(g.ativos)]],
    levar: levar(dados, g.totais), totalPaes: g.totalPaes,
    colunas: [
      { titulo: "#", peso: 0.45, alinhar: "centro" }, { titulo: "Cliente", peso: 2.2 }, { titulo: "Endereço", peso: 3 }, { titulo: "Telefone", peso: 1.5 },
      ...colunasPaes(dados), { titulo: "Total", peso: 0.7, alinhar: "centro" }, { titulo: "Entregue", peso: 0.9, alinhar: "centro", tipo: "caixa" },
    ],
    linhas: linhas.map((l, i) => [String(i + 1), l.nome, [l.endereco, l.bairro].filter(Boolean).join(" · "), telefone(l.whatsapp), ...dados.paes.map((p) => String(l.quantidades[p.id] ?? 0)), String(l.qtd), ""]),
    totais: ["", "Total", "", "", ...dados.paes.map((p) => String(g.totais[p.id] ?? 0)), String(g.totalPaes), ""],
    rodape: `Entrega ${g.nome}`,
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string; destino: string }> }) {
  const { id, destino } = await params;
  const { supabase } = await exigirEquipe();
  const dados = await carregarSemanaCompleta(supabase, id);
  if (!dados) return new Response("Semana não encontrada", { status: 404 });

  let doc: DocPdf, nome: string;
  if (destino === "producao") {
    doc = docProducao(dados); nome = "producao";
  } else {
    const g = dados.grupos.find((x) => x.chave.replace(/[^a-z0-9]+/gi, "-") === destino);
    if (!g) return new Response("Destino não encontrado", { status: 404 });
    if (g.tipo === "entrega") { doc = docEntrega(dados, g); nome = `entrega-${slug(g.nome)}`; }
    else {
      let endereco = "", horario = "";
      if (g.refId) {
        const { data: p } = await supabase.from("pontos_coleta").select("endereco, horario_texto, horarios").eq("id", g.refId).single();
        endereco = p?.endereco ?? "";
        const h = (p?.horarios ?? []) as { dia: number; abre: string; fecha: string }[];
        horario = p?.horario_texto ?? (h.length ? h.map((j) => `${DIAS_CURTO[j.dia]} ${j.abre}-${j.fecha}`).join("; ") : "");
      }
      doc = docRetirada(dados, g, endereco, horario); nome = `retirada-${slug(g.nome)}`;
    }
  }
  const bytes = await gerarPdf(doc);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${nome}-${dados.semana.inicio || hojeISO()}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
