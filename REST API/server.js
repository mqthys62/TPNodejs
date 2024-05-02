const express = require("express");
const postgres = require("postgres");
const z = require("zod");
const app = express();
const port = 8000;
const sql = postgres({ db: "mydb" });
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    info: {
      title: "ShopAPI with Swagger",
      version: "0.1.0",
      description: "Shop api for users and products",
      contact: {
        name: "Shop",
        email: "shop@email.com",
      },
    },
    servers: [
      {
        url: "http://localhost:8000",
      },
    ],
  },
  apis: ["./server.js"],
};
const specs = swaggerJsdoc(options);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
app.use(express.json());

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});
const CreateProductSchema = ProductSchema.omit({ id: true });

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  password: z.string(),
});

const UpdateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(5).optional(),
});

const CreateOrderSchema = z.object({
  userId: z.number(),
  productId: z.number(),
  quantity: z.number().positive(),
});

const UpdateOrderSchema = z.object({
  userId: z.number().optional(),
  productId: z.number().optional(),
  quantity: z.number().positive().optional(),
});

const CreateUserSchema = UserSchema.omit({ id: true });

const getUsers = UserSchema.omit({ password: false });

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Récupérer une liste de produits
 *     description: Récupère une liste de tous les produits disponibles dans la base de données.
 *     responses:
 *       200:
 *         description: Liste des produits récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       500:
 *         description: Erreur lors de l'accès à la base de données.
 */

app.get("/products", async (req, res) => {
  const { name, about, price } = req.query;

  let conditions = [];
  let values = [];

  if (name) {
    conditions.push("name = $" + (conditions.length + 1));
    values.push(name);
  }
  if (about) {
    conditions.push("about = $" + (conditions.length + 1));
    values.push(about);
  }
  if (price) {
    conditions.push("price = $" + (conditions.length + 1));
    values.push(parseFloat(price));
  }

  const sqlQuery = `
      SELECT * FROM products
      ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
    `;

  try {
    const products = await sql.unsafe(sqlQuery, values);
    res.json(products);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error accessing the database", error: error.message });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Récupérer un produit par son ID
 *     description: Récupère les détails d'un produit spécifique par son ID dans la base de données.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique du produit à récupérer.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails d'un produit récupéré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Produit non trouvé. Aucun produit avec cet ID n'existe.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative d'accès à la base de données.
 */
app.get("/products/:id", async (req, res) => {
  const [product] =
    await sql`SELECT * FROM products WHERE id = ${req.params.id}`;

  if (product.length > 0) {
    res.json(product);
  } else {
    res.status(404).json({ message: "Produit non trouvé" });
  }
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary:
 *     description: Add a new product to the database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProduct'
 *     responses:
 *       201:
 *         description: Product created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Invalid request body.
 */
app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);

  if (result.success) {
    const [product] = await sql`
        INSERT INTO products ${sql(result.data, "name", "about", "price")}
        RETURNING *
      `;
    res.json(product[0]);
  } else {
    res.status(400).json({ message: "Invalid request body" });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Supprimer un produit
 *     description: Supprime un produit de la base de données en utilisant son ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique du produit à supprimer.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Produit supprimé avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Produit non trouvé. Aucun produit correspondant à cet ID n'a été trouvé.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative de suppression du produit.
 */
app.delete("/products/:id", async (req, res) => {
  const [product] =
    await sql`DELETE FROM products WHERE id = ${req.params.id} RETURNING *`;

  if (product.length > 0) {
    res.json(product);
  } else {
    res.status(404).json({ message: "Produit non trouvé" });
  }
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Récupérer une liste d'utilisateurs
 *     description: Récupère une liste de tous les utilisateurs enregistrés dans la base de données.
 *     responses:
 *       200:
 *         description: Liste des utilisateurs récupérée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       500:
 *         description: Erreur interne du serveur lors de l'accès à la base de données.
 */
app.get("/users", async (req, res) => {
  const users = await sql`SELECT * FROM users`;
  res.json(users.map(getUsers.parse));
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Récupérer un utilisateur par son ID
 *     description: Récupère les détails d'un utilisateur spécifique par son ID dans la base de données.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique de l'utilisateur à récupérer.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Détails de l'utilisateur récupérés avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Utilisateur non trouvé. Aucun utilisateur avec cet ID n'existe.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative d'accès à la base de données.
 */
app.get("/users/:id", async (req, res) => {
  const [user] = await sql`SELECT * FROM users WHERE id = ${req.params.id}`;

  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Créer un nouvel utilisateur
 *     description: Ajoute un nouvel utilisateur dans la base de données. Le mot de passe est hashé avant l'enregistrement.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès. Renvoie les données de l'utilisateur créé.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Corps de la requête invalide. Ne peut pas parser les données de l'utilisateur.
 *       500:
 *         description: Erreur interne du serveur lors de la création de l'utilisateur.
 */
app.post("/users", async (req, res) => {
  const result = await CreateUserSchema.safeParse(req.body);

  if (result.success) {
    const hashedPassword = await bcrypt.hash(result.data.password, 10);
    result.data.password = hashedPassword;
    const [user] = await sql`
          INSERT INTO users ${sql(result.data, "name", "email", "password")}
          RETURNING *
          `;
    res.json(result.data);
  } else {
    res.status(400).json({ message: "Invalid request body" });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Supprimer un utilisateur
 *     description: Supprime un utilisateur de la base de données en utilisant son ID. Retourne l'utilisateur supprimé si l'opération réussit.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique de l'utilisateur à supprimer.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès. Renvoie les détails de l'utilisateur supprimé.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Utilisateur non trouvé. Aucun utilisateur avec cet ID n'a été trouvé.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative de suppression de l'utilisateur.
 */

app.delete("/users/:id", async (req, res) => {
  const [user] =
    await sql`DELETE FROM users WHERE id = ${req.params.id} RETURNING *`;

  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Mettre à jour un utilisateur
 *     description: Met à jour les détails d'un utilisateur existant en utilisant son ID. Cette route attend des données complètes de l'utilisateur pour la mise à jour.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique de l'utilisateur à mettre à jour.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès. Renvoie les données mises à jour de l'utilisateur.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Corps de la requête invalide. Ne peut pas parser les données de l'utilisateur.
 *       404:
 *         description: Utilisateur non trouvé. Aucun utilisateur avec cet ID n'a été trouvé pour la mise à jour.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative de mise à jour de l'utilisateur.
 */
app.put("/users/:id", async (req, res) => {
  const result = await CreateUserSchema.safeParse(req.body);

  if (result.success) {
    const [user] = await sql`
              UPDATE users
              SET ${sql(result.data, "name", "email", "password")}
              WHERE id = ${req.params.id}
              RETURNING *
              `;
    res.json(user);
  } else {
    res.status(400).json({ message: "Invalid request body" });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Mettre à jour partiellement un utilisateur
 *     description: Met à jour les informations d'un utilisateur existant en utilisant son ID. Seules les informations fournies seront mises à jour.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique de l'utilisateur à mettre à jour partiellement.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: Informations de l'utilisateur mises à jour avec succès. Renvoie les données mises à jour de l'utilisateur.
 *       400:
 *         description: Corps de la requête invalide ou aucun champ valide fourni pour la mise à jour.
 *       404:
 *         description: Utilisateur non trouvé. Aucun utilisateur avec cet ID n'a été trouvé pour la mise à jour.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative de mise à jour de l'utilisateur.
 */

app.patch("/users/:id", async (req, res) => {
  const result = await UpdateUserSchema.safeParse(req.body);
  i;
  if (result.success) {
    const updates = Object.keys(result.data).reduce((acc, key) => {
      if (result.data[key] !== undefined) {
        acc[key] = result.data[key];
      }
      return acc;
    }, {});

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update" });
    }

    const [user] = await sql`
          UPDATE users
          SET ${sql(updates)}
          WHERE id = ${req.params.id}
          RETURNING *
        `;

    res.json(user);
  } else {
    res.status(400).json({ message: "Invalid request body" });
  }
});

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Créer une nouvelle commande
 *     description: Ajoute une nouvelle commande dans la base de données en utilisant les données fournies dans le corps de la requête. Calcule également le total de la commande en ajoutant la TVA.
 *     requestBody:
 *       required: true
 *     responses:
 *       201:
 *         description: Commande créée avec succès. Renvoie les détails de la commande créée.
 *       400:
 *         description: Données de commande invalides, erreur dans les données fournies.
 *       404:
 *         description: Produit non trouvé. Aucun produit avec l'ID fourni n'a été trouvé.
 *       500:
 *         description: Échec de la création de la commande due à une erreur interne du serveur.
 */

app.post("/orders", async (req, res) => {
  const result = await CreateOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res
      .status(400)
      .json({ message: "Invalid order data", errors: result.error.errors });
  }

  try {
    const [product] =
      await sql`SELECT price FROM products WHERE id = ${result.data.productId}`;
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const vatRate = 1.2;
    const total = product.price * result.data.quantity * vatRate;

    const [order] = await sql`
        INSERT INTO orders (userId, productId, quantity, total, createdAt, updatedAt)
        VALUES (${result.data.userId}, ${result.data.productId}, ${result.data.quantity}, ${total}, NOW(), NOW())
        RETURNING *
      `;
    res.status(201).json(order);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create order", error: error.message });
  }
});

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Récupérer une liste de toutes les commandes
 *     description: Récupère une liste complète de toutes les commandes stockées dans la base de données.
 *     responses:
 *       200:
 *         description: Liste de toutes les commandes récupérée avec succès.
 *       500:
 *         description: Erreur interne du serveur lors de l'accès à la base de données.
 */

app.get("/orders", async (req, res) => {
  const orders = await sql`SELECT * FROM orders`;
  res.json(orders);
});

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Récupérer une commande par son ID
 *     description: Récupère les détails d'une commande spécifique à partir de son identifiant unique dans la base de données.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique de la commande à récupérer.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Détails de la commande récupérés avec succès.
 *       404:
 *         description: Commande non trouvée. Aucune commande avec cet ID n'a été trouvée.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative de récupération de la commande.
 */

app.get("/orders/:id", async (req, res) => {
  const [order] = await sql`SELECT * FROM orders WHERE id = ${req.params.id}`;

  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: "Order not found" });
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Supprimer une commande
 *     description: Supprime une commande spécifique de la base de données en utilisant son identifiant unique. Retourne les détails de la commande supprimée si l'opération est réussie.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique de la commande à supprimer.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Commande supprimée avec succès, renvoie les détails de la commande supprimée.
 *       404:
 *         description: Commande non trouvée. Aucune commande avec cet ID n'a été trouvée.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative de suppression de la commande.
 */
app.delete("/orders/:id", async (req, res) => {
  const [order] =
    await sql`DELETE FROM orders WHERE id = ${req.params.id} RETURNING *`;

  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: "Order not found" });
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   patch:
 *     summary: Mettre à jour partiellement une commande
 *     description: Met à jour les informations d'une commande existante. Seuls les champs fournis dans le corps de la requête seront modifiés.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant unique de la commande à mettre à jour.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: Commande mise à jour avec succès. Renvoie les détails de la commande mise à jour.
 *       400:
 *         description: Corps de la requête invalide. Les données fournies ne peuvent pas être traitées.
 *       404:
 *         description: Commande non trouvée. Aucune commande avec cet ID n'a été trouvée pour la mise à jour.
 *       500:
 *         description: Erreur interne du serveur lors de la tentative de mise à jour de la commande.
 */
app.patch("/orders/:id", async (req, res) => {
  const result = await UpdateOrderSchema.safeParse(req.body);

  if (result.success) {
    const [order] = await sql`
          UPDATE orders
          SET ${sql(result.data, "userId", "productId", "quantity")}
          WHERE id = ${req.params.id}
          RETURNING *
        `;
    res.json(order);
  } else {
    res.status(400).json({ message: "Invalid request body" });
  }
});
