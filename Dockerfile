# Usando a imagem oficial do Node.js
FROM node:18-alpine

# Diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install --only=production

# Copia o restante dos arquivos da aplicação
COPY . .

# Cria um usuário não-root para executar a aplicação
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Muda a propriedade dos arquivos para o usuário nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expondo a porta 3000
EXPOSE 3000

# Comando para iniciar a API
CMD ["npm", "start"]