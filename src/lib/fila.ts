/** Fila offline do entregador em IndexedDB (aceita foto como Blob). */
export type ItemFila =
  | { key: string; criado: string; tipo: "iniciar"; semana: string; rota: string; em: string }
  | { key: string; criado: string; tipo: "finalizar"; semana: string; rota: string; em: string }
  | { key: string; criado: string; tipo: "entrega"; id: string; status: "entregue" | "nao_entregue" | "programada";
      ocorrencia?: string | null; observacao?: string | null; em: string; foto?: Blob | null; fotoPath?: string | null };

const BANCO = "amada-fila";
const LOJA = "itens";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA, { keyPath: "key" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const req = fn(db.transaction(LOJA, modo).objectStore(LOJA));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

export const novoItemKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function lerFila(): Promise<ItemFila[]> {
  try {
    const todos = await tx<ItemFila[]>("readonly", (s) => s.getAll());
    return todos.sort((a, b) => a.criado.localeCompare(b.criado));
  } catch {
    return [];
  }
}
export async function empilhar(item: ItemFila): Promise<void> {
  await tx("readwrite", (s) => s.put(item));
}
export async function remover(key: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(key));
}

type SemChave<T> = T extends unknown ? Omit<T, "key" | "criado"> : never;
export type NovoItem = SemChave<ItemFila>;
