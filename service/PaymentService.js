const axios = require('axios');
const Tour = require('../models/tourModel');

class PaymentService {
  constructor(tourID, user) {
    this.tourID = tourID;
    this.user = user;
  }

  async createPayment() {
    const url = 'https://api.mercadopago.com/checkout/preferences';
    const tour = await Tour.findById(this.tourID);
    const body = {
      payer_email: 'test_user_46945293@testuser.com',
      items: [
        {
          title: tour.name,
          description: tour.summary,
          picture_url: `https://www.natours.dev/img/tours/${tour.imageCover}`,
          quantity: 1,
          unit_price: tour.price,
        },
      ],
      back_urls: {
        success: 'https://www.natours.dev',
        failure: 'https://www.natours.dev',
      },
    };

    const payment = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer TEST-5868394625354150-022915-e572708ab7c292c848a777a633a691de-469021861`,
      },
    });

    return payment.data;
  }
}

module.exports = PaymentService;
