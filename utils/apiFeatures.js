class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    //creamos la query
    //filtramos los tours por los campos que se pasen en la query
    const queryObj = { ...this.queryString };
    //creamos un array con los campos que no queremos que se usen en la busqueda
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    //eliminamos los campos que no queremos que se usen en la busqueda
    excludedFields.forEach((el) => delete queryObj[el]);

    //advanced filtering
    //convertimos el objeto a un string
    let queryStr = JSON.stringify(queryObj);
    //reemplazamos los operadores de comparacion por el operador de comparacion de mongodb
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    //como obtenemos todos los tours de la base de datos filtrados por los campos que se pasen en la query
    this.query = this.query.find(JSON.parse(queryStr));

    return this; //retornamos el objeto para poder encadenar los metodos
  }

  sort() {
    if (this.queryString.sort) {
      //ordenamos los tours por los campos que se pasen en la query
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
      //sort('price ratingsAverage')
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this; //retornamos el objeto para poder encadenar los metodos
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');

      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this; //retornamos el objeto para poder encadenar los metodos
  }

  paginate() {
    const page = this.queryString.page * 1 || 1; //multiplicamos por 1 para convertirlo a un numero
    const limit = this.queryString.limit * 1 || 100; //multiplicamos por 1 para convertirlo a un numero
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this; //retornamos el objeto para poder encadenar los metodos
  }
}
module.exports = APIFeatures;
