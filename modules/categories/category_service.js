// Simple in-memory category service for demo/testing
const mockCategories = [
	{ id: '1', name: 'Electronics' },
	{ id: '2', name: 'Books' },
	{ id: '3', name: 'Clothing' },
];

async function getAll() {
	// simulate async op
	return Promise.resolve(mockCategories);
}

async function getById(id) {
	const c = mockCategories.find(x => x.id === id || x.id === String(id));
	return Promise.resolve(c || null);
}

module.exports = {
	getAll,
	getById,
};

