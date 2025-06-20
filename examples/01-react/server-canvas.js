module.exports = {
  createCanvas: () => ({
    getContext: () => ({
      canvas: { width: 0, height: 0 },
    }),
  }),
  Image: function () {},
};
