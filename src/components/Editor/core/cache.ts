
export function hashBlock(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h + content.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function hashBlockId(content: string): string {
  return hashBlock(content + ':' + _containerWidth);
}

let _containerWidth = 800;
export function setContainerWidth(w: number) { _containerWidth = w; }
export function getContainerWidth(): number { return _containerWidth; }

const imageDimCache = new Map<string, { width: number; height: number }>();

export function getCachedImageDim(url: string): { width: number; height: number } | undefined {
  return imageDimCache.get(url);
}

export function cacheImageDim(url: string, width: number, height: number): void {
  imageDimCache.set(url, { width, height });
}
