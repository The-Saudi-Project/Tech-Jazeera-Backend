/**
 * ApiResponse — the single success envelope for every endpoint.
 *
 * Every successful response is `{ success: true, message, data }`. The
 * frontend can then treat ALL endpoints identically: check `success`, show
 * `message` in a toast if relevant, use `data`. Without this, each endpoint
 * invents its own shape and the client fills up with special cases.
 *
 * Usage in a controller:
 *   res.status(201).json(new ApiResponse('Employee created', employee));
 */
class ApiResponse {
  /**
   * @param {string} message Short human-readable outcome ("Employee created")
   * @param {*}      [data]  Payload; defaults to null for message-only replies
   */
  constructor(message, data = null) {
    this.success = true;
    this.message = message;
    this.data = data;
  }
}

export default ApiResponse;
