/**
 * Reusable email dispatch service implementation.
 */
const EmailService = {
  sendEmail: function(recipient, subject, htmlBody) {
    try {
      MailApp.sendEmail({
        to: recipient,
        subject: subject,
        htmlBody: htmlBody
      });
      LoggerService.info('Email sent to: ' + recipient);
      return true;
    } catch (err) {
      LoggerService.error('Email failed: ' + err.message);
      return false;
    }
  }
};