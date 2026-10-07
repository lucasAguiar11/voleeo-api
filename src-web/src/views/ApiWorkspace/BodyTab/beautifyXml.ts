const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"

export function beautifyXml(text: string): string {
  try {
    const doc = new DOMParser().parseFromString(text, "application/xml")
    if (doc.querySelector("parsererror")) return text

    const serializer = new XMLSerializer()
    const declaration = text.match(/^\s*<\?xml\b[\s\S]*?\?>/)?.[0].trim()
    const nodes = Array.from(doc.childNodes).filter((node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue?.trim() !== ""
      return !(
        node.nodeType === Node.PROCESSING_INSTRUCTION_NODE &&
        node.nodeName === "xml"
      )
    })
    const lines = nodes.map((node) =>
      node.nodeType === Node.ELEMENT_NODE
        ? formatXmlElement(node as Element, 0, serializer)
        : serializer.serializeToString(node),
    )
    if (declaration) lines.unshift(declaration)
    return lines.join("\n")
  } catch {
    return text
  }
}

function formatXmlElement(
  node: Element,
  depth: number,
  serializer: XMLSerializer,
  inheritedPreserveSpace = false,
): string {
  const indent = "  ".repeat(depth)
  const children = Array.from(node.childNodes)
  const elements = children.filter(
    (child) => child.nodeType === Node.ELEMENT_NODE,
  )
  const xmlSpace = node.getAttributeNS(XML_NAMESPACE, "space")
  const preserveSpace =
    xmlSpace === "preserve" ||
    (xmlSpace !== "default" && inheritedPreserveSpace)
  const hasMixedContent = children.some((child) => {
    if (child.nodeType === Node.CDATA_SECTION_NODE) return true
    return (
      child.nodeType === Node.TEXT_NODE && (child.nodeValue ?? "").trim() !== ""
    )
  })

  if (elements.length === 0 || preserveSpace || hasMixedContent) {
    return `${indent}${serializeXmlElement(node, serializer)}`
  }

  const childNodes = children.filter(
    (child) =>
      child.nodeType === Node.ELEMENT_NODE ||
      child.nodeType === Node.COMMENT_NODE ||
      child.nodeType === Node.PROCESSING_INSTRUCTION_NODE,
  )
  const inner = childNodes
    .map((child) =>
      child.nodeType === Node.ELEMENT_NODE
        ? formatXmlElement(
            child as Element,
            depth + 1,
            serializer,
            preserveSpace,
          )
        : `${"  ".repeat(depth + 1)}${serializer.serializeToString(child)}`,
    )
    .join("\n")
  return `${indent}<${node.nodeName}${xmlAttributes(node)}>\n${inner}\n${indent}</${node.nodeName}>`
}

function serializeXmlElement(node: Element, serializer: XMLSerializer): string {
  const children = Array.from(node.childNodes)
  const opening = `<${node.nodeName}${xmlAttributes(node)}>`
  if (children.length === 0) return `${opening.slice(0, -1)}/>`
  return `${opening}${children.map((child) => serializeXmlNode(child, serializer)).join("")}</${node.nodeName}>`
}

function serializeXmlNode(node: Node, serializer: XMLSerializer): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return serializeXmlElement(node as Element, serializer)
  }
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeXmlText(node.nodeValue ?? "")
  }
  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    return `<![CDATA[${node.nodeValue ?? ""}]]>`
  }
  return serializer.serializeToString(node)
}

function xmlAttributes(node: Element): string {
  return Array.from(node.attributes)
    .map(
      (attribute) =>
        ` ${attribute.name}="${escapeXmlAttribute(attribute.value)}"`,
    )
    .join("")
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeXmlAttribute(text: string): string {
  return escapeXmlText(text).replace(/"/g, "&quot;")
}
