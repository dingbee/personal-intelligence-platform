import type {
  CapabilityJsonSchema,
  ContractIssue,
  ContractValidation,
  IntegrationCapabilityDescriptor,
  IntegrationProviderDescriptor,
} from './contracts'

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const PROTOCOLS = new Set(['api', 'webhook', 'mcp'])
const SCHEMA_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'])
const SCHEMA_KEYS = new Set([
  'type', 'title', 'description', 'enum', 'properties', 'required',
  'additionalProperties', 'items', 'minimum', 'maximum', 'minLength',
  'maxLength', 'pattern', 'minItems', 'maxItems',
])

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function issue(path: string, code: string, message: string): ContractIssue {
  return { path, code, message }
}

function validateSchema(
  schema: unknown,
  path: string,
  issues: ContractIssue[],
  depth = 0,
): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    issues.push(issue(path, 'invalid_schema', 'Schema must be an object.'))
    return
  }
  if (depth > 32) {
    issues.push(issue(path, 'schema_too_deep', 'Schema nesting exceeds the maximum depth of 32.'))
    return
  }

  const candidate = schema as Record<string, unknown>
  for (const key of Object.keys(candidate).sort()) {
    if (!SCHEMA_KEYS.has(key)) {
      issues.push(issue(`${path}.${key}`, 'unsupported_schema_keyword', 'Schema keyword is not supported by this contract validator.'))
    }
  }
  if (typeof candidate.type !== 'string' || !SCHEMA_TYPES.has(candidate.type)) {
    issues.push(issue(`${path}.type`, 'invalid_schema_type', 'Schema type must be a supported JSON value type.'))
    return
  }

  if (candidate.title !== undefined && !nonBlank(candidate.title)) {
    issues.push(issue(`${path}.title`, 'invalid_schema_title', 'Schema title must be non-empty when supplied.'))
  }
  if (candidate.description !== undefined && typeof candidate.description !== 'string') {
    issues.push(issue(`${path}.description`, 'invalid_schema_description', 'Schema description must be a string.'))
  }
  if (candidate.enum !== undefined) {
    if (!Array.isArray(candidate.enum) || candidate.enum.length === 0 ||
      candidate.enum.some((entry) => !isJsonPrimitive(entry)) ||
      new Set(candidate.enum.map((entry) => JSON.stringify(entry))).size !== candidate.enum.length) {
      issues.push(issue(`${path}.enum`, 'invalid_schema_enum', 'Enum must contain unique JSON primitive values.'))
    }
  }

  for (const key of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems'] as const) {
    const value = candidate[key]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      issues.push(issue(`${path}.${key}`, 'invalid_schema_bound', 'Schema bounds must be finite numbers.'))
    }
  }
  for (const key of ['minLength', 'maxLength', 'minItems', 'maxItems'] as const) {
    const value = candidate[key]
    if (typeof value === 'number' && (!Number.isInteger(value) || value < 0)) {
      issues.push(issue(`${path}.${key}`, 'invalid_schema_bound', 'Length and item bounds must be non-negative integers.'))
    }
  }
  if (typeof candidate.minimum === 'number' && typeof candidate.maximum === 'number' && candidate.minimum > candidate.maximum) {
    issues.push(issue(path, 'inverted_schema_bounds', 'Minimum cannot exceed maximum.'))
  }
  if (typeof candidate.minLength === 'number' && typeof candidate.maxLength === 'number' && candidate.minLength > candidate.maxLength) {
    issues.push(issue(path, 'inverted_schema_bounds', 'minLength cannot exceed maxLength.'))
  }
  if (typeof candidate.minItems === 'number' && typeof candidate.maxItems === 'number' && candidate.minItems > candidate.maxItems) {
    issues.push(issue(path, 'inverted_schema_bounds', 'minItems cannot exceed maxItems.'))
  }
  if (candidate.pattern !== undefined) {
    if (typeof candidate.pattern !== 'string') {
      issues.push(issue(`${path}.pattern`, 'invalid_schema_pattern', 'Pattern must be a string.'))
    } else {
      try { new RegExp(candidate.pattern) } catch {
        issues.push(issue(`${path}.pattern`, 'invalid_schema_pattern', 'Pattern must be a valid regular expression.'))
      }
    }
  }

  if (candidate.type === 'object') {
    if (candidate.properties !== undefined && (!candidate.properties || typeof candidate.properties !== 'object' || Array.isArray(candidate.properties))) {
      issues.push(issue(`${path}.properties`, 'invalid_schema_properties', 'Object properties must be a schema map.'))
    } else if (candidate.properties && typeof candidate.properties === 'object' && !Array.isArray(candidate.properties)) {
      for (const key of Object.keys(candidate.properties).sort()) {
        validateSchema((candidate.properties as Record<string, unknown>)[key], `${path}.properties.${key}`, issues, depth + 1)
      }
    }
    if (candidate.required !== undefined) {
      if (!Array.isArray(candidate.required) || candidate.required.some((key) => !nonBlank(key)) ||
        new Set(candidate.required).size !== candidate.required.length) {
        issues.push(issue(`${path}.required`, 'invalid_schema_required', 'Required must contain unique non-empty property names.'))
      } else if (candidate.properties && typeof candidate.properties === 'object' && !Array.isArray(candidate.properties)) {
        for (const key of candidate.required) {
          if (!Object.prototype.hasOwnProperty.call(candidate.properties, key)) {
            issues.push(issue(`${path}.required`, 'unknown_required_property', `Required property "${key}" has no declared schema.`))
          }
        }
      }
    }
    if (candidate.additionalProperties !== undefined && typeof candidate.additionalProperties !== 'boolean') {
      issues.push(issue(`${path}.additionalProperties`, 'invalid_additional_properties', 'additionalProperties must be boolean.'))
    }
  } else if (candidate.properties !== undefined || candidate.required !== undefined || candidate.additionalProperties !== undefined) {
    issues.push(issue(path, 'schema_keyword_type_mismatch', 'Object-only keywords require type "object".'))
  }

  if (candidate.type === 'array') {
    if (candidate.items === undefined) {
      issues.push(issue(`${path}.items`, 'missing_array_items', 'Array schemas must declare an item schema.'))
    } else {
      validateSchema(candidate.items, `${path}.items`, issues, depth + 1)
    }
  } else if (candidate.items !== undefined || candidate.minItems !== undefined || candidate.maxItems !== undefined) {
    issues.push(issue(path, 'schema_keyword_type_mismatch', 'Array-only keywords require type "array".'))
  }
  if (candidate.type !== 'string' && (candidate.minLength !== undefined || candidate.maxLength !== undefined || candidate.pattern !== undefined)) {
    issues.push(issue(path, 'schema_keyword_type_mismatch', 'String-only keywords require type "string".'))
  }
  if (!['number', 'integer'].includes(String(candidate.type)) && (candidate.minimum !== undefined || candidate.maximum !== undefined)) {
    issues.push(issue(path, 'schema_keyword_type_mismatch', 'Numeric bounds require type "number" or "integer".'))
  }
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
}

function validateCapability(capability: IntegrationCapabilityDescriptor, path: string, issues: ContractIssue[]): void {
  if (!capability || typeof capability !== 'object') {
    issues.push(issue(path, 'invalid_capability', 'Capability must be an object.'))
    return
  }
  if (!IDENTIFIER.test(capability.id)) issues.push(issue(`${path}.id`, 'invalid_identifier', 'Capability id must be a stable lowercase identifier.'))
  if (!SEMVER.test(capability.version)) issues.push(issue(`${path}.version`, 'invalid_version', 'Capability version must use semantic versioning.'))
  if (!nonBlank(capability.displayName)) issues.push(issue(`${path}.displayName`, 'required_field', 'Capability displayName is required.'))
  if (capability.description !== undefined && typeof capability.description !== 'string') issues.push(issue(`${path}.description`, 'invalid_description', 'Capability description must be a string.'))
  if (capability.accessMode !== 'read' && capability.accessMode !== 'write') issues.push(issue(`${path}.accessMode`, 'invalid_access_mode', 'Capability accessMode must be read or write.'))
  if (!nonBlank(capability.permission)) issues.push(issue(`${path}.permission`, 'required_field', 'Capability permission is required.'))
  if (typeof capability.requiresApproval !== 'boolean') issues.push(issue(`${path}.requiresApproval`, 'invalid_approval_policy', 'requiresApproval must be explicitly true or false.'))
  if (!Array.isArray(capability.actions) || capability.actions.length === 0 ||
    capability.actions.some((action) => !IDENTIFIER.test(action)) ||
    new Set(capability.actions).size !== capability.actions.length) {
    issues.push(issue(`${path}.actions`, 'invalid_actions', 'Actions must contain unique stable lowercase identifiers.'))
  }
  validateSchema(capability.inputSchema, `${path}.inputSchema`, issues)
  validateSchema(capability.outputSchema, `${path}.outputSchema`, issues)
}

export function validateIntegrationProviderDescriptor(
  descriptor: IntegrationProviderDescriptor,
): ContractValidation {
  const issues: ContractIssue[] = []
  if (!descriptor || typeof descriptor !== 'object') {
    return { valid: false, issues: [issue('$', 'invalid_descriptor', 'Provider descriptor must be an object.')] }
  }
  if (!IDENTIFIER.test(descriptor.providerId)) issues.push(issue('providerId', 'invalid_identifier', 'providerId must be a stable lowercase identifier.'))
  if (!SEMVER.test(descriptor.version)) issues.push(issue('version', 'invalid_version', 'Provider descriptor version must use semantic versioning.'))
  if (!nonBlank(descriptor.displayName)) issues.push(issue('displayName', 'required_field', 'Provider displayName is required.'))
  if (descriptor.description !== undefined && typeof descriptor.description !== 'string') issues.push(issue('description', 'invalid_description', 'Provider description must be a string.'))
  if (!Array.isArray(descriptor.protocols) || descriptor.protocols.length === 0 ||
    descriptor.protocols.some((protocol) => !PROTOCOLS.has(protocol)) ||
    new Set(descriptor.protocols).size !== descriptor.protocols.length) {
    issues.push(issue('protocols', 'invalid_protocols', 'Protocols must contain unique supported protocol values.'))
  }
  if (!Array.isArray(descriptor.capabilities) || descriptor.capabilities.length === 0) {
    issues.push(issue('capabilities', 'missing_capabilities', 'Provider must declare at least one capability.'))
  } else {
    const seen = new Set<string>()
    descriptor.capabilities.forEach((capability, index) => {
      validateCapability(capability, `capabilities[${index}]`, issues)
      if (capability && typeof capability.id === 'string' && typeof capability.version === 'string') {
        const key = `${capability.id}@${capability.version}`
        if (seen.has(key)) issues.push(issue(`capabilities[${index}]`, 'duplicate_capability_version', `Capability contract "${key}" is duplicated.`))
        seen.add(key)
      }
    })
  }

  issues.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message))
  return { valid: issues.length === 0, issues }
}

/** Validate runtime input/output data against the supported schema subset. */
export function validateCapabilityValue(
  schema: CapabilityJsonSchema,
  value: unknown,
  options: { maxDepth?: number } = {},
): ContractValidation {
  const issues: ContractIssue[] = []
  const maxDepth = options.maxDepth ?? 32

  function walk(currentSchema: CapabilityJsonSchema, current: unknown, path: string, depth: number): void {
    if (depth > maxDepth) {
      issues.push(issue(path, 'value_too_deep', `Value nesting exceeds maximum depth ${maxDepth}.`))
      return
    }
    const type = currentSchema.type
    const matches = type === 'null' ? current === null
      : type === 'array' ? Array.isArray(current)
      : type === 'object' ? current !== null && typeof current === 'object' && !Array.isArray(current)
      : type === 'integer' ? typeof current === 'number' && Number.isInteger(current)
      : type === 'number' ? typeof current === 'number' && Number.isFinite(current)
      : typeof current === type
    if (!matches) {
      issues.push(issue(path, 'type_mismatch', `Expected ${type}.`))
      return
    }

    if (currentSchema.enum && !currentSchema.enum.some((entry) => Object.is(entry, current))) {
      issues.push(issue(path, 'enum_mismatch', 'Value is not one of the declared enum values.'))
    }
    if (typeof current === 'string') {
      if (currentSchema.minLength !== undefined && current.length < currentSchema.minLength) issues.push(issue(path, 'string_too_short', `String length must be at least ${currentSchema.minLength}.`))
      if (currentSchema.maxLength !== undefined && current.length > currentSchema.maxLength) issues.push(issue(path, 'string_too_long', `String length must be at most ${currentSchema.maxLength}.`))
      if (currentSchema.pattern !== undefined && !new RegExp(currentSchema.pattern).test(current)) issues.push(issue(path, 'pattern_mismatch', 'String does not match the declared pattern.'))
    }
    if (typeof current === 'number') {
      if (currentSchema.minimum !== undefined && current < currentSchema.minimum) issues.push(issue(path, 'number_too_small', `Number must be at least ${currentSchema.minimum}.`))
      if (currentSchema.maximum !== undefined && current > currentSchema.maximum) issues.push(issue(path, 'number_too_large', `Number must be at most ${currentSchema.maximum}.`))
    }
    if (Array.isArray(current)) {
      if (currentSchema.minItems !== undefined && current.length < currentSchema.minItems) issues.push(issue(path, 'too_few_items', `Array must contain at least ${currentSchema.minItems} items.`))
      if (currentSchema.maxItems !== undefined && current.length > currentSchema.maxItems) issues.push(issue(path, 'too_many_items', `Array must contain at most ${currentSchema.maxItems} items.`))
      if (currentSchema.items) current.forEach((entry, index) => walk(currentSchema.items!, entry, `${path}[${index}]`, depth + 1))
    }
    if (current !== null && typeof current === 'object' && !Array.isArray(current) && currentSchema.type === 'object') {
      const objectValue = current as Record<string, unknown>
      for (const key of [...(currentSchema.required ?? [])].sort()) {
        if (!Object.prototype.hasOwnProperty.call(objectValue, key)) issues.push(issue(`${path}.${key}`, 'required_value_missing', 'Required property is missing.'))
      }
      for (const key of Object.keys(objectValue).sort()) {
        const propertySchema = currentSchema.properties?.[key]
        if (propertySchema) walk(propertySchema, objectValue[key], `${path}.${key}`, depth + 1)
        else if (currentSchema.additionalProperties === false) issues.push(issue(`${path}.${key}`, 'additional_property_forbidden', 'Additional properties are not allowed.'))
      }
    }
  }

  walk(schema, value, '$', 0)
  issues.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message))
  return { valid: issues.length === 0, issues }
}
