const v = {
  images: [{ id: "color123", url: "http://..." }],
  prices: [{
    id: "price1",
    VehicleColor: [{ colorId: "color123" }]
  }]
};

const formatVehicleMaster = (v) => {
  if (!v) return v;
  return {
    ...v,
    price: (v.prices || []).map(p => ({
      ...p,
      colors: (p.VehicleColor || []).map(c => {
        const colorObj = v.images?.find(img => img.id === c.colorId) || null;
        return {
          ...c,
          color: colorObj,
          imageDetails: colorObj ? [colorObj] : []
        };
      })
    }))
  };
};

console.log(JSON.stringify(formatVehicleMaster(v), null, 2));
