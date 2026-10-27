/** Imported images are plugin-owned copies; external folders are always read-only. */
import type { DataAdapter } from '../harness-ui';
export interface GalleryImage { id: string; name: string; created: number; type: string; width: number; height: number }
const validId = (id: string): boolean => /^[0-9a-f-]{36}$/i.test(id);
export class GalleryStore {
  constructor(private adapter: DataAdapter, private root: string) {}
  private path(id: string): string { if (!validId(id)) throw Error('Invalid library image'); return `${this.root}/${id}`; }
  async list(): Promise<GalleryImage[]> {
    if (!await this.adapter.exists(this.root)) return [];
    const images: GalleryImage[] = [];
    for (const dir of (await this.adapter.list(this.root)).folders) {
      const id = dir.slice(dir.lastIndexOf('/') + 1); if (!validId(id)) continue;
      try { const image = JSON.parse(await this.adapter.read(`${this.path(id)}/image.json`)) as GalleryImage;
        if (image.id === id && typeof image.name === 'string' && Number.isFinite(image.created) && ['image/png','image/jpeg','image/webp'].includes(image.type) && Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0) images.push(image);
      } catch { /* Isolate a damaged image manifest. */ }
    }
    return images.sort((a,b) => b.created-a.created);
  }
  async add(name: string, type: string, data: ArrayBuffer, width: number, height: number): Promise<GalleryImage> {
    if (!['image/png','image/jpeg','image/webp'].includes(type) || data.byteLength > 30 * 1024 * 1024 || !data.byteLength || !Number.isFinite(width+height) || width<=0 || height<=0) throw Error('Invalid library image');
    const image = { id: crypto.randomUUID(), name: name.trim().slice(0,150) || 'Image', created: Date.now(), type, width, height };
    if (!await this.adapter.exists(this.root)) { try { await this.adapter.mkdir(this.root); } catch(e) { if (!await this.adapter.exists(this.root)) throw e; } }
    await this.adapter.mkdir(this.path(image.id)); await this.adapter.writeBinary(`${this.path(image.id)}/image`,data); await this.adapter.write(`${this.path(image.id)}/image.json`,JSON.stringify(image)); return image;
  }
  data(image: GalleryImage): Promise<ArrayBuffer> { return this.adapter.readBinary(`${this.path(image.id)}/image`); }
  async rename(image: GalleryImage, name: string): Promise<void> { const next = name.trim().slice(0,150); if (!next) return; const copy = {...image,name:next}; await this.adapter.write(`${this.path(image.id)}/image.json`,JSON.stringify(copy)); image.name = next; }
  async remove(image: GalleryImage): Promise<void> { await this.adapter.rmdir(this.path(image.id),true); }
}
