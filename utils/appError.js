// Clase para manejar errores de la aplicación, hereda de la clase Error de javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message); //esto es para llamar al constructor de la clase padre
    this.statusCode = statusCode; //esto es para saber el status code
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'; //esto es para saber si el status code es 400 o 500, 500 es error, 400 es fail
    this.isOperational = true; //esto es para saber si el error es operacional o de programacion

    Error.captureStackTrace(this, this.constructor); //esto es para que no aparezca en el stack trace, stack trace es la pila de llamadas a funciones
  }
}

module.exports = AppError;
