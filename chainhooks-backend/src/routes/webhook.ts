import { Router, Request, Response } from 'express';

const router = Router();

router.post('/', (req: Request, res: Response) => {
    const event = req.body;
    console.log('Received Chainhook Event:', JSON.stringify(event, null, 2));

    // TODO: Verify signature
    // TODO: Process event (e.g., update database)

    res.status(200).json({ message: 'Event received' });
});

export default router;
