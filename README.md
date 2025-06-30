# API AWS - CRUD MongoDB, S3 e MySQL

Esta é uma API REST que demonstra integração com serviços AWS e bancos de dados MongoDB e MySQL.

## Funcionalidades

- ✅ **CRUD MongoDB**: Operações completas de usuários
- ✅ **S3 Operations**: Upload, listagem e remoção de arquivos em buckets
- ✅ **CRUD MySQL**: Operações completas de produtos
- ✅ **CloudWatch Logs**: Sistema de logging
- ✅ **Swagger Documentation**: Documentação automática da API

## Pré-requisitos

- Node.js (v14 ou superior)
- MongoDB
- MySQL
- Configuração AWS (credenciais ou IAM roles)

## Instalação

1. Clone o repositório
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
4. Edite o arquivo `.env` com suas configurações

5. Inicie a aplicação:
   ```bash
   npm start
   ```

## Endpoints

### MongoDB - Usuários

- `GET /usuarios` - Lista usuários (com paginação)
- `POST /usuarios` - Cria novo usuário
- `GET /usuarios/:id` - Busca usuário por ID
- `PUT /usuarios/:id` - Atualiza usuário
- `DELETE /usuarios/:id` - Remove usuário
- `GET /mongodb/testar-conexao` - Testa conexão MongoDB

### S3 - Buckets e Arquivos

- `GET /buckets` - Lista todos os buckets
- `GET /buckets/:bucketName` - Lista objetos de um bucket
- `POST /buckets/:bucketName/upload` - Upload de arquivo
- `DELETE /buckets/:bucketName/file/:fileName` - Remove arquivo

### MySQL - Produtos

- `POST /init-db` - Cria banco e tabela
- `GET /produtos` - Lista produtos
- `POST /produtos` - Cria produto
- `GET /produtos/:id` - Busca produto por ID
- `PUT /produtos/:id` - Atualiza produto
- `DELETE /produtos/:id` - Remove produto

## Documentação

Acesse a documentação Swagger em: `http://localhost:3000/swagger`

## Melhorias Implementadas no CRUD MongoDB

1. **Validação de dados**: Schema com validações robustas
2. **Validação de ObjectId**: Verificação de IDs válidos
3. **Prevenção de duplicatas**: Email único
4. **Paginação**: Suporte a paginação na listagem
5. **Timestamps automáticos**: createdAt e updatedAt
6. **Tratamento de erros**: Respostas JSON padronizadas
7. **Logging melhorado**: Logs estruturados para CloudWatch

## Variáveis de Ambiente

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/api-aws

# AWS
REGION=us-east-1
LOG_GROUP_NAME=/aws/lambda/api-aws
LOG_STREAM_NAME=api-aws-stream

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=api_aws_db
```

## Testando o CRUD MongoDB

```bash
# Criar usuário
curl -X POST http://localhost:3000/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nome": "João Silva", "email": "joao@email.com"}'

# Listar usuários (com paginação)
curl http://localhost:3000/usuarios?page=1&limit=5

# Buscar por ID
curl http://localhost:3000/usuarios/{id}

# Atualizar usuário
curl -X PUT http://localhost:3000/usuarios/{id} \
  -H "Content-Type: application/json" \
  -d '{"nome": "João Santos"}'

# Remover usuário
curl -X DELETE http://localhost:3000/usuarios/{id}
```
