/**
 * Controller for status check endpoint
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export function healthCheckController(req, res) {
    res.status(200).json({
      status: 'ok',
      message: 'Notes generator API is running',
      timestamp: new Date().toISOString(),
    });
  }