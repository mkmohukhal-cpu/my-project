/**
 * General helper utilities for formatting, ID generation, validation, and responses.
 */
const Helpers = {
  /**
   * Formats a date object or string to ISO standard YYYY-MM-DD.
   * @param {Date|string} date 
   * @return {string}
   */
  formatDate: function(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toISOString().split('T')[0];
  },

  /**
   * Generates a unique prefixed identifier code.
   * @param {string} prefix 
   * @return {string}
   */
  generateId: function(prefix) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return prefix + '-' + randomNum;
  },

  /**
   * Validates email string formatting.
   * @param {string} email 
   * @return {boolean}
   */
  validateEmail: function(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  },

  /**
   * Standardizes response object structure.
   * @param {boolean} success 
   * @param {string} message 
   * @param {*} data 
   * @return {Object}
   */
  buildResponse: function(success, message, data) {
    return {
      success: success,
      message: message || '',
      data: data !== undefined ? data : null,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * يحسب حالة انتهاء صلاحية مستند أو عقد بناءً على تاريخ الانتهاء.
 * دالة مشتركة يُستدعى عليها من Code.gs و Notification.gs — لا تُكرر في مكان آخر.
 * @param {string} expiryDateStr
 * @param {number} warningDays عدد الأيام قبل الانتهاء يُعتبر خلالها "قارب على الانتهاء"
 * @return {'Valid'|'Expiring Soon'|'Expired'}
 */
function calculateExpiryStatus(expiryDateStr, warningDays) {
  if (!expiryDateStr) return 'Valid';
  const days = warningDays || 30;
  const expiryDate = new Date(expiryDateStr);
  if (isNaN(expiryDate.getTime())) return 'Valid';
  const today = new Date();
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays <= days) return 'Expiring Soon';
  return 'Valid';
}