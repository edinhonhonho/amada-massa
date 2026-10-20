/** Reduz a foto para JPEG de até ~1280 px (cerca de 150–300 KB) antes de guardar/enviar. */
export async function comprimirImagem(arquivo: File, maximo = 1280, qualidade = 0.72): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, maximo / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("falha ao comprimir"))), "image/jpeg", qualidade));
}
