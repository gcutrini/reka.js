module.exports = {
  createCanvas: () => ({
    getContext: () => ({
      canvas: { width: 0, height: 0 },
    }),
  }),
  // Minimal stub for Konva's Image constructor
  Image: function Image() {
    // noop so Konva can call addEventListener without throwing
    this.addEventListener = function () {
      return undefined;
    };
  },
};
