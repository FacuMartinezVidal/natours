const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) => {
  const jwtToken = jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  return jwtToken;
};

const createSendToken = (user, statusCode, res) => {
  //las cookies son un fragmento de texto que el servidor le envía al cliente y que el cliente le envía al servidor en cada petición
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      //convertimos el tiempo de expiración a milisegundos
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    //se envía solo en conexiones encriptadas para que no se pueda leer el token
    //secure: true,
    //para que el token no pueda ser modificado por el cliente
    httpOnly: true,
  };

  //si estamos en desarrollo, no usamos https, por lo que no podemos enviar cookies seguras
  if (process.env.NODE_ENV === ' production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  //para que no se envíe el password en la respuesta
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};

exports.signup = catchAsync(async (req, res) => {
  // esto no es seguro, ya que el usuario podría enviar cualquier campo que quiera, como role: 'admin'
  // const newUser = await User.create(req.body);

  // por lo que es mejor hacerlo de esta manera, para que solo se puedan enviar los campos que queremos
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  });

  //req.protocol es http o https, req.get('host') es el dominio
  const url = `${req.protocol}://${req.get('host')}/me`;
  //enviamos el email de bienvenida
  new Email(newUser, url).sendWelcome();

  // creamos el token
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  //destructuramos el email y el password del body
  const { email, password } = req.body;

  //verificamos que el email y el password existan
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  //buscamos el usuario por su email
  const user = await User.findOne({
    email,
  }).select('+password');

  //verificamos que la contraseña sea correcta
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  //si todo está bien, creamos el token
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.clearCookie('jwt');
  res.status(200).json({ status: 'success' });
};

//middleware para proteger las rutas, es decir, para verificar que el usuario esté autenticado
exports.protect = catchAsync(async (req, res, next) => {
  //obtenemos el token y verificamos que exista
  //->1.Check if we have a token for access
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];

    // } else if (req.cookies.jwt && req.cookies.jwt !== 'loggedout') { //WE DO NOT NEED THIS ANYMORE!!!
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.redirect('/'); //ADD RETURN fix the issue of logging out when the user is on the /me account settings page and when logged out TAKES TO TO / ROUTE AND GETS RID OF ERR__HTTP_HEADERS_SENT ERROR....ERROR CHECK BELOW IS TOTALLY POINTLESS.
    // return next(
    //   new AppError('You are not logged in! Please login to get access', 401)
    // ); //We stop the user to proceed further if he is missing a token first... Token created @ login...
  }
  //verficamos que el token exista
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //verificamos que el usuario siga existiendo
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401,
      ),
    );
  }
  //verificamos que el usuario no haya cambiado su contraseña después de que se emitió el token
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }

  //si todo está bien, guardamos el usuario en la request para que el siguiente middleware lo pueda usar
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

//middleware para paginas renderizadas, no errores
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  // if (req.cookies.jwt === 'loggedout') {// GET RID OF THIS LINE
  if (req.cookies.jwt === null) {
    return next();
  }
  if (req.cookies.jwt) {
    //->1.Verify Token
    const decoded = await promisify(jwt.verify)(
      req.cookies.jwt,
      process.env.JWT_SECRET,
    );
    //->2.Check if the user still exists(not deleted)
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next();
    } //IF TRUE (NO USER EXISTS) GET OUT OF THIS MIDDLEWARE AND MOVEON WITH THE NEXT()
    //->3.Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next();
    } //IF TRUE (PASSWORD CHANGED) GET OUT OF THIS MIDDLEWARE AND MOVEON WITH THE NEXT()

    //->GRANT ACCESS TO THE PROTECTED VIEW
    res.locals.user = currentUser; //VERY IMPORTANT! Each and every pug template will have access to res.locals. So whatever variable defiend thru locals is accessible by PUG files.
    // console.log('🧤', req.user);
    return next();
  }
  next(); //IF THERE IS NO RES.COOKIE THEN GET OUT OF THIS MIDDLEWARE AND MOVEON WITH THE NEXT()
});

//middleware para verificar que el usuario tenga permisos para realizar ciertas acciones
exports.restrictTo = (...roles) => {
  const permisionHandler = (req, res, next) => {
    //roles es un array, por lo que podemos usar el método includes para verificar si el rol del usuario está en el array
    if (!roles.includes(req.user.role)) {
      return next(
        //403 significa forbidden, es decir, que el usuario no tiene permisos para realizar la acción
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };
  return permisionHandler;
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //obtenemos el usuario por su email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  //generamos el token
  const resetToken = user.createPasswordResetToken();

  //guardamos los cambios en la base de datos, validateBeforeSave es para que no se validen los campos antes de guardarlos
  await user.save({ validateBeforeSave: false });

  try {
    //enviamos el email
    const resetURL = `${req.protocol}://${req.get(
      'host',
    )}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    //si hay un error, eliminamos el token y la fecha de expiración
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500,
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //obtener el usuario por el token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  //buscamos el usuario por el token y que no haya expirado
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  //si el token no ha expirado y hay un usuario, actualizamos la contraseña
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  //actualizamos el changedPasswordAt del usuario en el modelo

  //Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //obtenemos el usuario de la base de datos
  //usamos select para que el password sea seleccionado, ya que lo habiamos deseleccionado en el modelo
  const user = await User.findById(req.user.id).select('+password');

  //verificamos que la contraseña actual sea correcta
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  //actualizamos la contraseña
  //no usamos findByIdAndUpdate ya que los middlewares de mongoose no se ejecutarían
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  //Log user in, send JWT
  createSendToken(user, 200, res);
});
