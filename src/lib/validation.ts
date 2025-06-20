// Validação de email
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email) {
    return { isValid: false, error: 'Email é obrigatório' };
  }

  // Regex mais robusto para validação de email
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Formato de email inválido' };
  }

  // Verificar comprimento
  if (email.length > 254) {
    return { isValid: false, error: 'Email muito longo' };
  }

  // Verificar se não começa ou termina com ponto
  if (email.startsWith('.') || email.endsWith('.')) {
    return { isValid: false, error: 'Email não pode começar ou terminar com ponto' };
  }

  return { isValid: true };
}

// Validação de senha
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: 'Senha é obrigatória' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Senha deve ter pelo menos 8 caracteres' };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Senha muito longa' };
  }

  // Verificar se contém pelo menos uma letra maiúscula
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Senha deve conter pelo menos uma letra maiúscula' };
  }

  // Verificar se contém pelo menos uma letra minúscula
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Senha deve conter pelo menos uma letra minúscula' };
  }

  // Verificar se contém pelo menos um número
  if (!/\d/.test(password)) {
    return { isValid: false, error: 'Senha deve conter pelo menos um número' };
  }

  // Verificar se contém pelo menos um caractere especial
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, error: 'Senha deve conter pelo menos um caractere especial' };
  }

  return { isValid: true };
}

// Validação de nome
export function validateName(name: string): { isValid: boolean; error?: string } {
  if (!name) {
    return { isValid: false, error: 'Nome é obrigatório' };
  }

  if (name.length < 2) {
    return { isValid: false, error: 'Nome deve ter pelo menos 2 caracteres' };
  }

  if (name.length > 100) {
    return { isValid: false, error: 'Nome muito longo' };
  }

  // Verificar se contém apenas letras, espaços e alguns caracteres especiais
  const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
  if (!nameRegex.test(name)) {
    return { isValid: false, error: 'Nome contém caracteres inválidos' };
  }

  return { isValid: true };
}

// Sanitização de entrada
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove caracteres potencialmente perigosos
    .replace(/\s+/g, ' '); // Remove espaços múltiplos
}

// Validação de URL
export function validateUrl(url: string): { isValid: boolean; error?: string } {
  if (!url) {
    return { isValid: false, error: 'URL é obrigatória' };
  }

  try {
    const urlObj = new URL(url);
    
    // Verificar se é HTTP ou HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL deve usar HTTP ou HTTPS' };
    }

    // Verificar comprimento
    if (url.length > 2048) {
      return { isValid: false, error: 'URL muito longa' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'URL inválida' };
  }
} 
