import JSZip from 'jszip'
import type {
  DocumentProcessor,
  ExtractedChapter,
  ExtractionResult,
} from '@/modules/processing/extractors/types'
import { countWords, normalizeText } from '@/modules/processing/extractors/textStats'

const XML_MIME = 'application/xml'
const XHTML_MIME = 'application/xhtml+xml'

function parseXml(xml: string, mimeType = XML_MIME): Document {
  return new DOMParser().parseFromString(xml, mimeType as DOMParserSupportedType)
}

/** Joins a path relative to `baseDir` (the OPF's directory), collapsing `..`/`.`. */
function resolvePath(baseDir: string, relativeHref: string): string {
  const href = relativeHref.split('#')[0]!
  const segments = (baseDir ? `${baseDir}/${href}` : href).split('/')
  const resolved: string[] = []
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') resolved.pop()
    else resolved.push(segment)
  }
  return resolved.join('/')
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path) ?? zip.file(path.replace(/^\//, ''))
  return entry ? entry.async('text') : null
}

async function findOpfPath(zip: JSZip): Promise<string> {
  const containerXml = await readZipText(zip, 'META-INF/container.xml')
  if (!containerXml) throw new Error('Invalid EPUB: missing META-INF/container.xml')
  const doc = parseXml(containerXml)
  const rootfile = doc.querySelector('rootfile')
  const path = rootfile?.getAttribute('full-path')
  if (!path) throw new Error('Invalid EPUB: no OPF rootfile declared')
  return path
}

function htmlToText(html: string): string {
  const doc = parseXml(html, XHTML_MIME)
  if (doc.querySelector('parsererror')) {
    // Some EPUB XHTML isn't well-formed XML; fall back to lenient HTML parsing.
    const fallback = new DOMParser().parseFromString(html, 'text/html')
    return (fallback.body?.textContent ?? '').trim()
  }
  return (doc.body?.textContent ?? doc.documentElement.textContent ?? '').trim()
}

async function parseNcxTitles(
  zip: JSZip,
  opfDir: string,
  ncxHref: string,
): Promise<Map<string, string>> {
  const ncxPath = resolvePath(opfDir, ncxHref)
  const ncxXml = await readZipText(zip, ncxPath)
  const titlesByHref = new Map<string, string>()
  if (!ncxXml) return titlesByHref

  const doc = parseXml(ncxXml)
  const ncxDir = ncxPath.includes('/') ? ncxPath.slice(0, ncxPath.lastIndexOf('/')) : ''
  for (const navPoint of Array.from(doc.querySelectorAll('navPoint'))) {
    const label = navPoint.querySelector('navLabel > text')?.textContent?.trim()
    const src = navPoint.querySelector('content')?.getAttribute('src')
    if (label && src) {
      titlesByHref.set(resolvePath(ncxDir, src), label)
    }
  }
  return titlesByHref
}

export const epubProcessor: DocumentProcessor = {
  fileType: 'epub',
  async extract(file: Blob): Promise<ExtractionResult> {
    const zip = await JSZip.loadAsync(file)
    const opfPath = await findOpfPath(zip)
    const opfXml = await readZipText(zip, opfPath)
    if (!opfXml) throw new Error('Invalid EPUB: OPF file referenced but not found')

    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''
    const opf = parseXml(opfXml)

    const title = opf.querySelector('metadata > title, metadata > dc\\:title')?.textContent?.trim() ?? null
    const author =
      opf.querySelector('metadata > creator, metadata > dc\\:creator')?.textContent?.trim() ?? null
    const language =
      opf.querySelector('metadata > language, metadata > dc\\:language')?.textContent?.trim() ?? null

    const manifestItems = new Map<string, { href: string; mediaType: string }>()
    for (const item of Array.from(opf.querySelectorAll('manifest > item'))) {
      const id = item.getAttribute('id')
      const href = item.getAttribute('href')
      const mediaType = item.getAttribute('media-type') ?? ''
      if (id && href) manifestItems.set(id, { href, mediaType })
    }

    const ncxItem = Array.from(manifestItems.values()).find(
      (item) => item.mediaType === 'application/x-dtbncx+xml',
    )
    const navTitlesByHref = ncxItem ? await parseNcxTitles(zip, opfDir, ncxItem.href) : new Map()

    const spineIds = Array.from(opf.querySelectorAll('spine > itemref'))
      .map((itemref) => itemref.getAttribute('idref'))
      .filter((id): id is string => Boolean(id))

    const chapters: ExtractedChapter[] = []
    let index = 0
    for (const id of spineIds) {
      const manifestItem = manifestItems.get(id)
      if (!manifestItem || manifestItem.mediaType !== XHTML_MIME) continue

      const chapterPath = resolvePath(opfDir, manifestItem.href)
      const chapterHtml = await readZipText(zip, chapterPath)
      if (!chapterHtml) continue

      const text = normalizeText(htmlToText(chapterHtml))
      if (!text) continue

      chapters.push({
        index,
        title: navTitlesByHref.get(chapterPath) ?? `Chapter ${index + 1}`,
        text,
      })
      index += 1
    }

    const fullText = normalizeText(chapters.map((chapter) => chapter.text).join('\n\n'))

    return {
      text: fullText,
      title,
      author,
      language,
      pageCount: null,
      wordCount: countWords(fullText),
      charCount: fullText.length,
      chapters,
    }
  },
}
