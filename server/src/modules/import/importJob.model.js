import mongoose from 'mongoose';

const importJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['CSV', 'XLSX'],
      required: true,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    validRows: {
      type: Number,
      default: 0,
    },
    invalidRows: {
      type: Number,
      default: 0,
    },
    productsCreated: {
      type: Number,
      default: 0,
    },
    variantsCreated: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PREVIEWED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED'],
      default: 'PREVIEWED',
      index: true,
    },
    errors: [
      {
        row: { type: Number, required: true },
        productName: { type: String, default: '' },
        sku: { type: String, default: '' },
        code: { type: String, default: 'VALIDATION_ERROR' },
        message: { type: String, required: true },
      },
    ],
    previewData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

const ImportJob = mongoose.model('ImportJob', importJobSchema);
export default ImportJob;
