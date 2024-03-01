const pug = require('pug');
const nodeMailer = require('nodemailer');
const { convert } = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Facundo Martinez Vidal <${process.env.EMAIL_FROM}>`;
  }

  NewTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Sendgrid
      return nodeMailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }
    return nodeMailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html),
    };

    // 3) Create a transport and send email
    await this.NewTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)',
    );
  }
};

const sendEmail = async (options) => {
  //creamos el transporter, que es el servicio que se encarga de enviar el email, ej: gmail, hotmail, etc
  //   const transporter = nodeMailer.createTransport({
  //     service: 'Gmail',
  //     auth: {
  //       user: process.env.EMAIL_USERNAME,
  //       pass: process.env.EMAIL_PASSWORD,
  //     },
  // Activate in gmail "less secure app" option
  const transporter = nodeMailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: 'ff3f3df7321e07',
      pass: '4daa9beb655dc0',
    },
  });

  //definir opciones del email
  const mailOptions = {
    from: 'Facundo Martinez Vidal <facumartinezvidal@gmail.com',
    to: options.email,
    subject: options.subject,
    text: options.message,
    // html:
  };

  //enviar el email
  await transporter.sendMail(mailOptions);
};

// module.exports = Email;
