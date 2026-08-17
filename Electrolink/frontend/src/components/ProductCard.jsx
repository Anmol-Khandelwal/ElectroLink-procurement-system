import { Link } from "react-router-dom";

function ProductCard({ product }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      
      {/* Product Image */}
      <div className="flex h-56 items-center justify-center bg-slate-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-5xl">⚡</span>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="p-6">
        
        {/* Category */}
        <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
          {product.category}
        </p>

        {/* Product Name */}
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          {product.product_name}
        </h2>

        {/* Part Number */}
        <p className="mt-3 text-sm text-slate-600">
          Part No:{" "}
          <span className="font-semibold text-slate-800">
            {product.part_number}
          </span>
        </p>

        {/* Manufacturer */}
        <p className="mt-1 text-sm text-slate-600">
          Manufacturer:{" "}
          <span className="font-semibold text-slate-800">
            {product.manufacturer || "Not specified"}
          </span>
        </p>

        {/* Price and Stock */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-3xl font-bold text-slate-900">
            ₹{Number(product.price).toFixed(2)}
          </p>

          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
            {product.available_stock} in stock
          </span>
        </div>

        {/* Minimum Order */}
        <p className="mt-3 text-sm text-slate-500">
          Minimum order: {product.minimum_order_quantity}
        </p>

        {/* View Details Button */}
        <Link
          to={`/products/${product.id}`}
          className="mt-6 block rounded-xl bg-blue-600 px-5 py-3 text-center font-semibold text-white transition hover:bg-blue-700"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

export default ProductCard;