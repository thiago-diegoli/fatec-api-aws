# Usando a imagem oficial do Node.js
FROM node:18-alpine

# Diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante dos arquivos
COPY . .

# Expondo a porta da API
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]