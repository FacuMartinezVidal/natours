const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: { type: String, default: 'default.jpg' },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    //esto es para que el password no se muestre en las respuestas de las peticiones
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This only works on CREATE and SAVE!!!
      validator: function (el) {
        //el es el valor que se esta validando, en este caso el passwordConfirm
        return el === this.password;
        //this.password es el valor del password
      },
      message: 'Passwords are not the same!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

//middleware para encriptar el password antes de guardarlo en la base de datos
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  if (process.env.NODE_ENV === 'LOADER') {
    this.isNew = true;
    return next();
  }

  //hash se usa para encriptar el password, el segundo argumento es el costo de la encriptacion
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

//middleware para actualizar el passwordChangedAt cuando el usuario cambie su contraseña
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  //restamos 1 segundo para asegurarnos que el token de reseteo de contraseña siempre sea creado despues de que el password haya sido cambiado
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

//middleware para no mostrar los usuarios que no esten activos, se usa en todas las consultas que usen find
userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

//metodo para comparar el password que el usuario ingresa con el password encriptado en la base de datos
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

//middleware para actualizar el passwordChangedAt cuando el usuario cambie su contraseña
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};

//middleware para crear el token de reseteo de contraseña
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  //encriptamos el token y lo guardamos en la base de datos
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  //el token expira en 10 minutos, esto es en milisegundos
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

//model siempre empieza con mayuscula, es una convecion de javascript
const User = mongoose.model('User', userSchema);
module.exports = User;
