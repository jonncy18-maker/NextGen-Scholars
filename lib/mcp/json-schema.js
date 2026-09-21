// Converts lib/ai/tools.js's Gemini function-declaration parameter schema
// (OpenAPI subset — uppercase STRING/NUMBER/BOOLEAN/OBJECT type names) into
// standard JSON Schema, which is what MCP's tools/list inputSchema expects.
// Same registry, two schema dialects — this is the only place that matters.

const TYPE_MAP = { STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean', OBJECT: 'object' };

export function toJsonSchema(param) {
  if (!param) return { type: 'object', properties: {} };
  const out = { type: TYPE_MAP[param.type] || 'string' };
  if (param.description) out.description = param.description;
  if (param.type === 'OBJECT') {
    out.properties = {};
    for (const [key, value] of Object.entries(param.properties || {})) {
      out.properties[key] = toJsonSchema(value);
    }
    out.required = param.required?.length ? param.required : [];
  }
  return out;
}
