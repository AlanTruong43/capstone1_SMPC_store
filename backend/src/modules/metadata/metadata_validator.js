// Category validation
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

/**
 * Validate and normalize category data
 * Category should have: name (required), slug (required), description (optional, string)
 */
function validateAndNormalizeCategory(input = {}) {
  const errors = {};
  const out = {};

  // name - required string
  if (!isNonEmptyString(input.name)) {
    errors.name = "Category name is required";
  } else {
    out.name = input.name.trim();
  }

  // slug - required string, must be lowercase and alphanumeric with hyphens
  if (!isNonEmptyString(input.slug)) {
    errors.slug = "Category slug is required";
  } else {
    const slug = input.slug.trim().toLowerCase();
    // Validate slug format: lowercase, alphanumeric, hyphens, underscores only
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      errors.slug = "Slug must contain only lowercase letters, numbers, hyphens, and underscores";
    } else {
      out.slug = slug;
    }
  }

  // description - optional string
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") {
      errors.description = "Description must be a string";
    } else {
      out.description = input.description.trim();
    }
  }

  if (Object.keys(errors).length) {
    return { valid: false, errors };
  }
  return { valid: true, data: out };
}

module.exports = { validateAndNormalizeCategory };

