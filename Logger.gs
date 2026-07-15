/**
 * Centralized logging framework writing directly to the Logs sheet.
 */
const LoggerService = {
  log: function(level, message) {
    try {
      const user = Session.getActiveUser().getEmail() || 'system';
      const timestamp = new Date().toISOString();
      Database.insertRow('Logs', {
        timestamp: timestamp,
        level: level,
        message: message,
        user: user
      });
    } catch (e) {
      console.error('Fallback log: ' + message);
    }
  },
  info: function(msg) { this.log('INFO', msg); },
  warn: function(msg) { this.log('WARN', msg); },
  error: function(msg) { this.log('ERROR', msg); }
};