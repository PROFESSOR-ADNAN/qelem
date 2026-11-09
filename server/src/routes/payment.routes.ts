import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';

export const paymentRouter = Router();

paymentRouter.get('/status', PaymentController.getStatus);
paymentRouter.post('/chapa/initialize', PaymentController.initializeTip);
paymentRouter.get('/chapa/verify/:txRef', PaymentController.verifyTip);
paymentRouter.post('/chapa/webhook', PaymentController.webhook);
