require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const multer = require("multer");
const multerS3 = require("multer-s3");

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: "*",
  })
);

//BD
const mongoose = require("mongoose");
//swagger
const swaggerDocs = require("./swagger");
//S3
const AWS = require("aws-sdk");

//Log
const { logInfo, logError } = require("./logger");

app.use(express.json());

/**
 * @swagger
 * tags:
 *   - name: CRUD MongoDb
 *     description: Operações de CRUD para usuários no MongoDb.
 *   - name: CRUD MySQL
 *     description: Operações de CRUD para produtos no MySQL.
 *   - name: Buckets
 *     description: Operações de Listar buckets, upload e remoção de arquivo para um bucket S3.
 */

//#region CRUD MongoDb
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => logInfo("MongoDB conectado", null))
  .catch((err) => logError("Erro ao logar mongodb" + err, null, err));

const UserSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: [true, "Nome é obrigatório"],
      trim: true,
      minlength: [2, "Nome deve ter pelo menos 2 caracteres"],
      maxlength: [100, "Nome não pode ter mais de 100 caracteres"],
    },
    email: {
      type: String,
      required: [true, "Email é obrigatório"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Email inválido"],
    },
  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  }
);

const User = mongoose.model("Usuario", UserSchema);

/**
 * @swagger
 * /mongodb/testar-conexao:
 *   get:
 *     tags:
 *       - CRUD MongoDb
 *     summary: Testa a conexão com o MongoDB
 *     description: Verifica se a aplicação consegue se conectar ao MongoDB.
 *     responses:
 *       200:
 *         description: Conexão bem-sucedida
 *       500:
 *         description: Erro na conexão com o MongoDB
 */
app.get("/mongodb/testar-conexao", async (req, res) => {
  try {
    // Verificar se já está conectado
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne(); // Consulta simples (primeiro usuário encontrado)

      logInfo("Conexão com o MongoDB verificada com sucesso", req);

      if (user) {
        res.status(200).json({
          message: "Conexão com o MongoDB bem-sucedida e usuário encontrado!",
          status: "connected",
          hasUsers: true,
        });
      } else {
        res.status(200).json({
          message:
            "Conexão com o MongoDB bem-sucedida, mas nenhum usuário encontrado.",
          status: "connected",
          hasUsers: false,
        });
      }
    } else {
      res.status(500).json({
        message: "MongoDB não está conectado",
        status: "disconnected",
      });
    }
  } catch (error) {
    await logError("Erro ao testar conexão com MongoDb: " + error, req, error);
    res.status(500).json({
      error: "Erro na conexão com o MongoDB",
      details: error.message,
    });
  }
});

/**
 * @swagger
 * /usuarios:
 *   post:
 *     tags:
 *       - CRUD MongoDb
 *     summary: Criar um novo usuário
 *     description: Este endpoint cria um novo usuário no sistema.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Nome do usuário
 *               email:
 *                 type: string
 *                 description: Email do usuário
 *             required:
 *               - nome
 *               - email
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: ID do usuário
 *                 nome:
 *                   type: string
 *                 email:
 *                   type: string
 *       400:
 *         description: Requisição inválida.
 */
app.post("/usuarios", async (req, res) => {
  try {
    const { nome, email } = req.body;

    // Validação básica
    if (!nome || !email) {
      return res.status(400).json({ error: "Nome e email são obrigatórios" });
    }

    // Verificar se o email já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email já está em uso" });
    }

    const user = new User({ nome, email });
    await user.save();
    logInfo("Usuário criado", req);
    res.status(201).json(user);
  } catch (error) {
    logError("Erro ao criar usuário", req, error);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

/**
 * @swagger
 * /usuarios:
 *   get:
 *     tags:
 *       - CRUD MongoDb
 *     summary: Listar todos os usuários
 *     description: Este endpoint retorna todos os usuários cadastrados no sistema com paginação opcional.
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Número da página (padrão 1)
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         description: Limite de usuários por página (padrão 10, máximo 100)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       nome:
 *                         type: string
 *                       email:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalUsers:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 */
app.get("/usuarios", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Validar limites
    if (limit > 100) {
      return res
        .status(400)
        .json({ error: "Limite máximo é 100 usuários por página" });
    }

    const skip = (page - 1) * limit;

    // Buscar usuários com paginação
    const users = await User.find()
      .sort({ createdAt: -1 }) // Ordenar por mais recente
      .skip(skip)
      .limit(limit);

    // Contar total de usuários
    const totalUsers = await User.countDocuments();
    const totalPages = Math.ceil(totalUsers / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalUsers,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    logInfo("Usuários encontrados", req, {
      count: users.length,
      page,
      totalUsers,
    });

    res.json({
      users,
      pagination,
    });
  } catch (error) {
    logError("Erro ao buscar usuários", req, error);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     tags:
 *       - CRUD MongoDb
 *     summary: Obter um usuário específico
 *     description: Este endpoint retorna um usuário baseado no ID fornecido.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do usuário
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 nome:
 *                   type: string
 *                 email:
 *                   type: string
 *       404:
 *         description: Usuário não encontrado.
 */
app.get("/usuarios/:id", async (req, res) => {
  try {
    // Validar se o ID é um ObjectId válido
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    logInfo("Usuário encontrado", req, user);
    res.json(user);
  } catch (error) {
    logError("Erro ao buscar usuário", req, error);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     tags:
 *       - CRUD MongoDb
 *     summary: Atualizar um usuário específico
 *     description: Este endpoint atualiza um usuário baseado no ID fornecido.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do usuário
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuário atualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 nome:
 *                   type: string
 *                 email:
 *                   type: string
 *       404:
 *         description: Usuário não encontrado.
 */
app.put("/usuarios/:id", async (req, res) => {
  try {
    // Validar se o ID é um ObjectId válido
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const { nome, email } = req.body;

    // Validação básica
    if (!nome && !email) {
      return res.status(400).json({
        error: "Pelo menos um campo (nome ou email) deve ser fornecido",
      });
    }

    // Se email está sendo atualizado, verificar se já existe
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        return res
          .status(400)
          .json({ error: "Email já está em uso por outro usuário" });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...(nome && { nome }), ...(email && { email }) },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    logInfo("Usuário atualizado", req, user);
    res.json(user);
  } catch (error) {
    logError("Erro ao atualizar usuário", req, error);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     tags:
 *       - CRUD MongoDb
 *     summary: Remover um usuário específico
 *     description: Este endpoint remove um usuário baseado no ID fornecido.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do usuário
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário removido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 nome:
 *                   type: string
 *                 email:
 *                   type: string
 *       404:
 *         description: Usuário não encontrado.
 */
app.delete("/usuarios/:id", async (req, res) => {
  try {
    // Validar se o ID é um ObjectId válido
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const result = await User.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    logInfo("Usuário removido", req);
    res.json({ message: "Usuário removido com sucesso" });
  } catch (error) {
    logError("Erro ao remover usuário", req, error);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});
//#endregion

//#region S3
// AWS SDK irá automaticamente usar IAM Role da instância EC2
AWS.config.update({
  region: process.env.REGION,
});

const s3 = new AWS.S3();

/**
 * @swagger
 * /buckets:
 *   get:
 *     summary: Lista todos os buckets
 *     tags:
 *       - Buckets
 *     responses:
 *       200:
 *         description: Lista de todos os buckets
 */
app.get("/buckets", async (req, res) => {
  try {
    const data = await s3.listBuckets().promise();
    logInfo("Buckets encontrados", req, data.Buckets);
    res.status(200).json(data.Buckets);
  } catch (error) {
    logError("Erro ao buscar buckets", req, error);
    res.status(500).json({ error: "Erro ao listar buckets", details: error });
  }
});

/**
 * @swagger
 * /buckets/{bucketName}:
 *   get:
 *     summary: Lista os objetos de um bucket
 *     tags:
 *       - Buckets
 *     parameters:
 *       - in: path
 *         name: bucketName
 *         required: true
 *         description: Nome do bucket
 *     responses:
 *       200:
 *         description: Lista dos objetos do bucket
 */
app.get("/buckets/:bucketName", async (req, res) => {
  const { bucketName } = req.params;
  const params = {
    Bucket: bucketName,
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    logInfo("Objetos encontrados", req, data.Contents);
    res.status(200).json(data.Contents);
  } catch (error) {
    logError("Erro ao buscar objetos", req, error);
    res
      .status(500)
      .json({ error: "Erro ao listar objetos do bucket", details: error });
  }
});

/**
 * @swagger
 * /buckets/{bucketName}/upload:
 *   post:
 *     summary: Faz o upload de um arquivo para um bucket
 *     tags:
 *       - Buckets
 *     parameters:
 *       - in: path
 *         name: bucketName
 *         required: true
 *         description: Nome do bucket
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Arquivo enviado com sucesso
 */
//Utilizar alguma lib para fazer o upload/strem de arquivos, sugestão: multer
// Configuração do multer para armazenar em memória
const upload = multer({ storage: multer.memoryStorage() });
app.post(
  "/buckets/:bucketName/upload",
  upload.single("file"),
  async (req, res) => {
    const { bucketName } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const params = {
      Bucket: bucketName,
      Key: file.originalname,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    try {
      const data = await s3.upload(params).promise();
      logInfo("Upload efetuado", req, data);
      res.status(200).json({ message: "Upload concluído com sucesso", data });
    } catch (error) {
      logError("Erro ao efetuar upload", req, error);
      res.status(500).json({ message: "Erro no upload", error: error.message });
    }
  }
);

/**
 * @swagger
 * /buckets/{bucketName}/file/{fileName}:
 *   delete:
 *     summary: Deleta um arquivo específico de um bucket
 *     tags:
 *       - Buckets
 *     parameters:
 *       - in: path
 *         name: bucketName
 *         required: true
 *         description: Nome do bucket
 *       - in: path
 *         name: fileName
 *         required: true
 *         description: Nome do arquivo a ser deletado
 *     responses:
 *       200:
 *         description: Arquivo deletado com sucesso
 */
app.delete("/buckets/:bucketName/file/:fileName", async (req, res) => {
  const { bucketName, fileName } = req.params;

  try {
    const params = {
      Bucket: bucketName,
      Key: fileName,
    };

    await s3.deleteObject(params).promise();
    logInfo("Objeto removido", req, { bucketName, fileName });
    res.status(200).json({
      message: "Arquivo deletado com sucesso",
      deletedFile: fileName,
      bucket: bucketName,
    });
  } catch (error) {
    logError("Erro ao remover objeto", req, error);
    res.status(500).json({
      error: "Erro ao deletar arquivo do bucket",
      details: error.message,
    });
  }
});
//#endregion

//#region CRUD MySQL
const mysql = require("mysql2/promise");

const DB_NAME = process.env.DB_NAME || "api_aws_db";

// Criar pool de conexões MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * @swagger
 * /mysql/testar-conexao:
 *   get:
 *     tags:
 *       - CRUD MySQL
 *     summary: Testa a conexão com o MySQL
 *     description: Verifica se a aplicação consegue se conectar ao MySQL.
 *     responses:
 *       200:
 *         description: Conexão bem-sucedida
 *       500:
 *         description: Erro na conexão com o MySQL
 */
app.get("/mysql/testar-conexao", async (req, res) => {
  try {
    // Testar a conexão
    const connection = await pool.getConnection();

    // Verificar se o banco existe e tem produtos
    await connection.query(`USE \`${DB_NAME}\``);
    const [rows] = await connection.query(
      "SELECT COUNT(*) as total FROM produto"
    );

    connection.release();

    logInfo("Conexão com o MySQL verificada com sucesso", req);

    const totalProdutos = rows[0].total;

    res.status(200).json({
      message:
        totalProdutos > 0
          ? `Conexão com o MySQL bem-sucedida! ${totalProdutos} produto(s) encontrado(s).`
          : "Conexão com o MySQL bem-sucedida, mas nenhum produto encontrado.",
      status: "connected",
      hasProducts: totalProdutos > 0,
      totalProducts: totalProdutos,
    });
  } catch (error) {
    logError("Erro ao testar conexão com MySQL: " + error, req, error);
    res.status(500).json({
      error: "Erro na conexão com o MySQL",
      details: error.message,
    });
  }
});

/**
 * @swagger
 * /init-db:
 *   post:
 *     tags:
 *       - CRUD MySQL
 *     summary: Cria o banco de dados e a tabela produto
 *     description: Inicializa o banco de dados MySQL e cria a tabela de produtos.
 *     responses:
 *       200:
 *         description: Banco de dados e tabela criados com sucesso
 *       500:
 *         description: Erro ao criar banco de dados
 */
app.post("/init-db", async (req, res) => {
  try {
    // Primeiro, criar o banco de dados
    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);

    // Depois, usar o banco de dados e criar a tabela
    await pool.query(`USE \`${DB_NAME}\``);

    const createTableQuery = `CREATE TABLE IF NOT EXISTS produto (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      Nome VARCHAR(255) NOT NULL,
      Descricao VARCHAR(255) NOT NULL,
      Preco DECIMAL(10,2) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`;

    await pool.query(createTableQuery);

    logInfo("Banco de dados e tabela criados com sucesso", req);
    res
      .status(200)
      .json({ message: "Banco de dados e tabela criados com sucesso." });
  } catch (err) {
    logError("Erro ao criar banco de dados: " + err.message, req, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /produtos:
 *   post:
 *     tags:
 *       - CRUD MySQL
 *     summary: Criar um novo produto
 *     description: Este endpoint cria um novo produto no sistema MySQL.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Nome
 *               - Descricao
 *               - Preco
 *             properties:
 *               Nome:
 *                 type: string
 *                 description: Nome do produto
 *                 minLength: 2
 *                 maxLength: 255
 *               Descricao:
 *                 type: string
 *                 description: Descrição do produto
 *                 minLength: 2
 *                 maxLength: 255
 *               Preco:
 *                 type: number
 *                 description: Preço do produto
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Produto criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: ID do produto criado
 *                 Nome:
 *                   type: string
 *                 Descricao:
 *                   type: string
 *                 Preco:
 *                   type: number
 *       400:
 *         description: Requisição inválida
 *       500:
 *         description: Erro interno do servidor
 */
app.post("/produtos", async (req, res) => {
  const { Nome, Descricao, Preco } = req.body;

  try {
    // Validação básica
    if (!Nome || !Descricao || Preco === undefined) {
      return res.status(400).json({
        error: "Nome, Descrição e Preço são obrigatórios",
      });
    }

    // Validações adicionais
    if (Nome.length < 2 || Nome.length > 255) {
      return res.status(400).json({
        error: "Nome deve ter entre 2 e 255 caracteres",
      });
    }

    if (Descricao.length < 2 || Descricao.length > 255) {
      return res.status(400).json({
        error: "Descrição deve ter entre 2 e 255 caracteres",
      });
    }

    if (isNaN(Preco) || Preco < 0) {
      return res.status(400).json({
        error: "Preço deve ser um número positivo",
      });
    }

    await pool.query(`USE \`${DB_NAME}\``);
    const [result] = await pool.query(
      "INSERT INTO produto (Nome, Descricao, Preco) VALUES (?, ?, ?)",
      [Nome.trim(), Descricao.trim(), parseFloat(Preco)]
    );

    const produtoId = result.insertId;
    logInfo("Produto criado", req, { id: produtoId, Nome, Descricao, Preco });

    res.status(201).json({
      id: produtoId,
      Nome: Nome.trim(),
      Descricao: Descricao.trim(),
      Preco: parseFloat(Preco),
    });
  } catch (err) {
    logError("Erro ao criar produto", req, err);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

/**
 * @swagger
 * /produtos:
 *   get:
 *     tags:
 *       - CRUD MySQL
 *     summary: Listar todos os produtos
 *     description: Este endpoint retorna todos os produtos cadastrados no sistema MySQL com paginação opcional.
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Número da página (padrão 1)
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         description: Limite de produtos por página (padrão 10, máximo 100)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista de produtos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       Id:
 *                         type: integer
 *                       Nome:
 *                         type: string
 *                       Descricao:
 *                         type: string
 *                       Preco:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalProducts:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro interno do servidor
 */
app.get("/produtos", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Validar limites
    if (limit > 100) {
      return res
        .status(400)
        .json({ error: "Limite máximo é 100 produtos por página" });
    }

    if (page < 1) {
      return res
        .status(400)
        .json({ error: "Número da página deve ser maior que 0" });
    }

    const offset = (page - 1) * limit;

    await pool.query(`USE \`${DB_NAME}\``);

    // Buscar produtos com paginação
    const [products] = await pool.query(
      "SELECT * FROM produto ORDER BY createdAt DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );

    // Contar total de produtos
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM produto"
    );
    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalProducts,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    logInfo("Produtos encontrados", req, {
      count: products.length,
      page,
      totalProducts,
    });

    res.json({
      products,
      pagination,
    });
  } catch (err) {
    logError("Erro ao buscar produtos", req, err);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

/**
 * @swagger
 * /produtos/{id}:
 *   get:
 *     tags:
 *       - CRUD MySQL
 *     summary: Obter um produto específico
 *     description: Este endpoint retorna um produto baseado no ID fornecido.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do produto
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Produto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 Id:
 *                   type: integer
 *                 Nome:
 *                   type: string
 *                 Descricao:
 *                   type: string
 *                 Preco:
 *                   type: number
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Produto não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.get("/produtos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Validar se o ID é um número válido
    if (isNaN(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "ID deve ser um número inteiro positivo" });
    }

    await pool.query(`USE \`${DB_NAME}\``);
    const [rows] = await pool.query("SELECT * FROM produto WHERE Id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    logInfo("Produto encontrado", req, rows[0]);
    res.json(rows[0]);
  } catch (err) {
    logError("Erro ao buscar produto", req, err);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

/**
 * @swagger
 * /produtos/{id}:
 *   put:
 *     tags:
 *       - CRUD MySQL
 *     summary: Atualizar um produto específico
 *     description: Este endpoint atualiza um produto baseado no ID fornecido.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do produto
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Nome:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *               Descricao:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *               Preco:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Produto atualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 Id:
 *                   type: integer
 *                 Nome:
 *                   type: string
 *                 Descricao:
 *                   type: string
 *                 Preco:
 *                   type: number
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Produto não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.put("/produtos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Validar se o ID é um número válido
    if (isNaN(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "ID deve ser um número inteiro positivo" });
    }

    const { Nome, Descricao, Preco } = req.body;

    // Validação básica - pelo menos um campo deve ser fornecido
    if (!Nome && !Descricao && Preco === undefined) {
      return res.status(400).json({
        error:
          "Pelo menos um campo (Nome, Descrição ou Preço) deve ser fornecido",
      });
    }

    // Validações específicas para cada campo
    const updates = {};
    if (Nome !== undefined) {
      if (Nome.length < 2 || Nome.length > 255) {
        return res.status(400).json({
          error: "Nome deve ter entre 2 e 255 caracteres",
        });
      }
      updates.Nome = Nome.trim();
    }

    if (Descricao !== undefined) {
      if (Descricao.length < 2 || Descricao.length > 255) {
        return res.status(400).json({
          error: "Descrição deve ter entre 2 e 255 caracteres",
        });
      }
      updates.Descricao = Descricao.trim();
    }

    if (Preco !== undefined) {
      if (isNaN(Preco) || Preco < 0) {
        return res.status(400).json({
          error: "Preço deve ser um número positivo",
        });
      }
      updates.Preco = parseFloat(Preco);
    }

    await pool.query(`USE \`${DB_NAME}\``);

    // Construir query dinamicamente
    const updateFields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const updateValues = Object.values(updates);
    updateValues.push(id);

    const [result] = await pool.query(
      `UPDATE produto SET ${updateFields} WHERE Id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    // Buscar o produto atualizado
    const [rows] = await pool.query("SELECT * FROM produto WHERE Id = ?", [id]);
    const produtoAtualizado = rows[0];

    logInfo("Produto atualizado", req, produtoAtualizado);
    res.json(produtoAtualizado);
  } catch (err) {
    logError("Erro ao atualizar produto", req, err);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

/**
 * @swagger
 * /produtos/{id}:
 *   delete:
 *     tags:
 *       - CRUD MySQL
 *     summary: Remover um produto específico
 *     description: Este endpoint remove um produto baseado no ID fornecido.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do produto
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Produto removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedProduct:
 *                   type: object
 *                   properties:
 *                     Id:
 *                       type: integer
 *                     Nome:
 *                       type: string
 *                     Descricao:
 *                       type: string
 *                     Preco:
 *                       type: number
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Produto não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
app.delete("/produtos/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Validar se o ID é um número válido
    if (isNaN(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "ID deve ser um número inteiro positivo" });
    }

    await pool.query(`USE \`${DB_NAME}\``);

    // Primeiro buscar o produto para retornar suas informações
    const [rows] = await pool.query("SELECT * FROM produto WHERE Id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const produtoParaRemover = rows[0];

    // Remover o produto
    const [result] = await pool.query("DELETE FROM produto WHERE Id = ?", [id]);

    logInfo("Produto removido", req, produtoParaRemover);
    res.json({
      message: "Produto removido com sucesso",
      deletedProduct: produtoParaRemover,
    });
  } catch (err) {
    logError("Erro ao remover produto", req, err);
    res.status(500).json({ error: "Ocorreu um erro interno" });
  }
});

//#endregion

swaggerDocs(app);
app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
