import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import webhookRoutes from './routes/webhook';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Chainhooks Backend is running!');
});

app.use('/webhook', webhookRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
