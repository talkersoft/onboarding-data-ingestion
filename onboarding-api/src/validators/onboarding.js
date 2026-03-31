function validate(body) {
  const errors = [];

  if (!body.accountNo || typeof body.accountNo !== 'string' || !body.accountNo.trim()) {
    errors.push('accountNo is required and must be a non-empty string');
  }
  if (!body.firstName || typeof body.firstName !== 'string' || !body.firstName.trim()) {
    errors.push('firstName is required and must be a non-empty string');
  }
  if (!body.lastName || typeof body.lastName !== 'string' || !body.lastName.trim()) {
    errors.push('lastName is required and must be a non-empty string');
  }
  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('email is required and must be a non-empty string');
  } else if (!body.email.includes('@')) {
    errors.push('email must be a valid email address');
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
}

module.exports = { validate };
