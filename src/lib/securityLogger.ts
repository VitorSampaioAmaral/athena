interface SecurityEvent {
  type: 'login' | 'logout' | 'register' | 'failed_login' | 'failed_register' | 'access_denied' | 'rate_limit';
  userId?: string;
  email?: string;
  ip: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

class SecurityLogger {
  private logSecurityEvent(event: SecurityEvent) {
    const logEntry = {
      ...event,
      timestamp: event.timestamp.toISOString(),
      environment: process.env.NODE_ENV,
    };

    // Em produção, você pode enviar para um serviço de logging
    // como Winston, Bunyan, ou um serviço externo como LogRocket
    console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
  }

  logLogin(userId: string, email: string, ip: string, userAgent?: string) {
    this.logSecurityEvent({
      type: 'login',
      userId,
      email,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  }

  logLogout(userId: string, email: string, ip: string, userAgent?: string) {
    this.logSecurityEvent({
      type: 'logout',
      userId,
      email,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  }

  logRegister(userId: string, email: string, ip: string, userAgent?: string) {
    this.logSecurityEvent({
      type: 'register',
      userId,
      email,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  }

  logFailedLogin(email: string, ip: string, reason: string, userAgent?: string) {
    this.logSecurityEvent({
      type: 'failed_login',
      email,
      ip,
      userAgent,
      details: { reason },
      timestamp: new Date(),
    });
  }

  logFailedRegister(email: string, ip: string, reason: string, userAgent?: string) {
    this.logSecurityEvent({
      type: 'failed_register',
      email,
      ip,
      userAgent,
      details: { reason },
      timestamp: new Date(),
    });
  }

  logAccessDenied(userId: string, email: string, ip: string, resource: string, userAgent?: string) {
    this.logSecurityEvent({
      type: 'access_denied',
      userId,
      email,
      ip,
      userAgent,
      details: { resource },
      timestamp: new Date(),
    });
  }

  logRateLimit(ip: string, endpoint: string, userAgent?: string) {
    this.logSecurityEvent({
      type: 'rate_limit',
      ip,
      userAgent,
      details: { endpoint },
      timestamp: new Date(),
    });
  }
}

export const securityLogger = new SecurityLogger(); 
