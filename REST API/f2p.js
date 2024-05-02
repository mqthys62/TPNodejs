
const url = "http://localhost:8000/products";

fetch(url)
  .then((response) => {
    if (response.ok) {
      return response.json();
    }
    throw new Error("Erreur de connexion.");
  })
  .then((data) => {
    console.log(data);
  })
  .catch((error) => {
    console.error("Il y a eu un problème: ", error);
  });


