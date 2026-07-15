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