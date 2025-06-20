module.exports = {
  createCanvas: () => ({
    getContext: () => ({
      canvas: { width: 0, height: 0 },
    }),
  }),
  // Minimal stub for Konva's Image constructor
  Image: function Image() {
    this.addEventListener = () => {};
  },
};
