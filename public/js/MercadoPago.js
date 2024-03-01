import { showAlert } from './alert';
import axios from 'axios';

const mp = new MercadoPago('TEST-f19382a2-a1df-466d-9f9b-5090a335c9a7', {
  locale: 'es-AR',
});

export const bookTour = async (tourID) => {
  const container = document.querySelector('.checkout-container');
  // 1) Get checkout session from API
  try {
    const session = await axios({
      method: 'GET',
      url: `http://localhost:8000/api/v1/bookings/checkout-session/${tourID}`,
    });

    console.log(session.data.data.id);

    // 2) Create checkout form + charge credit card
    const checkout = await mp.checkout({
      preference: {
        id: session.data.data.id,
      },
    });
    const bookBtn = document.getElementById('book-tour');
    bookBtn.remove();
    checkout.render({
      container: '.checkout-container', // Reemplaza con el selector del contenedor donde quieres mostrar el formulario
    });
  } catch (err) {
    showAlert('error', err);
  }
};
