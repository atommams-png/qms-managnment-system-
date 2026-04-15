// ============================================================
// UTILITY FUNCTIONS
// ============================================================

// Generate UUID
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate random exam code
export function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Format error response
export function errorResponse(message, statusCode = 400) {
  return {
    statusCode,
    body: {
      error: message,
      timestamp: new Date().toISOString()
    }
  };
}

// Format success response
export function successResponse(data, message = 'Success') {
  return {
    statusCode: 200,
    body: {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    }
  };
}

// Parse JSON fields from database
export function parseDbRow(row) {
  if (!row) return null;
  const parsed = { ...row };

  // Parse JSON fields if they exist
  if (parsed.options && typeof parsed.options === 'string') {
    parsed.options = JSON.parse(parsed.options);
  }
  if (parsed.option_images && typeof parsed.option_images === 'string') {
    parsed.option_images = JSON.parse(parsed.option_images);
  }
  if (parsed.answers && typeof parsed.answers === 'string') {
    parsed.answers = JSON.parse(parsed.answers);
  }

  return parsed;
}

// Convert snake_case to camelCase
export function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

// Convert camelCase to snake_case
export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
