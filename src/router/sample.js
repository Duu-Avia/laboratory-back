import { Router } from 'express';
import { getSampleTypes } from '../controller/get-sample-types.js';
import { getIndicatorsBySampleType } from '../controller/get-indicators.js';
import { createSample } from '../controller/create-sample.js';
import { getSamples } from '../controller/get-samples.js';
import { getSampleIndicators } from '../controller/get-sample-indicators.js';
import { saveResults } from '../controller/save-results.js';
import { generatePDF } from '../controller/generate-pdf.js';
import { getResult } from '../controller/get-result.js';

const sampleRouter = Router();

sampleRouter.get('/types', getSampleTypes);
sampleRouter.post('/create', createSample);
sampleRouter.get('/list', getSamples);
sampleRouter.post('/results', saveResults);
sampleRouter.get('/:sampleId/pdf', generatePDF);
sampleRouter.get('/indicators/:sampleTypeId', getIndicatorsBySampleType);
sampleRouter.get('/:sampleId/indicators', getSampleIndicators);
sampleRouter.get('/result/:sampleId', getResult);

export default sampleRouter;