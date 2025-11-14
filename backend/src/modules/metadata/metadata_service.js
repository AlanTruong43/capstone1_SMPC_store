// Category service - CRUD operations for categories
const { admin, db } = require('../../config/firebase');
const categoryCol = db.collection("categories");
const productCol = db.collection("products");

/**
 * Get all categories with pagination and search (admin)
 */
async function getAllCategoriesAdmin(filters = {}) {
  const { page = 1, limit = 50, search } = filters;
  
  try {
    const snapshot = await categoryCol.get();
    let categories = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        slug: data.slug || '',
        description: data.description || ''
      };
    });

    // Apply search filter (client-side)
    if (search) {
      const searchLower = search.toLowerCase();
      categories = categories.filter(cat => 
        (cat.name && cat.name.toLowerCase().includes(searchLower)) ||
        (cat.slug && cat.slug.toLowerCase().includes(searchLower)) ||
        (cat.description && cat.description.toLowerCase().includes(searchLower))
      );
    }

    // Sort by name
    categories.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Get product counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const productsSnapshot = await productCol.where("categoryId", "==", cat.id).get();
        return {
          ...cat,
          productCount: productsSnapshot.size
        };
      })
    );

    // Pagination
    const total = categoriesWithCounts.length;
    const startIndex = (page - 1) * limit;
    const paginatedCategories = categoriesWithCounts.slice(startIndex, startIndex + parseInt(limit));

    return {
      categories: paginatedCategories,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }
}

/**
 * Create a new category (admin)
 */
async function createCategoryAdmin(payload) {
  try {
    // Check if slug already exists
    const existingSlug = await categoryCol.where("slug", "==", payload.slug).limit(1).get();
    if (!existingSlug.empty) {
      throw new Error("Category with this slug already exists");
    }

    // Check if name already exists
    const existingName = await categoryCol.where("name", "==", payload.name).limit(1).get();
    if (!existingName.empty) {
      throw new Error("Category with this name already exists");
    }

    const newDoc = {
      name: payload.name,
      slug: payload.slug,
      description: payload.description || ''
    };

    const ref = await categoryCol.add(newDoc);
    return {
      id: ref.id,
      ...newDoc
    };
  } catch (error) {
    throw new Error(`Failed to create category: ${error.message}`);
  }
}

/**
 * Update a category (admin)
 */
async function updateCategoryAdmin(categoryId, updates) {
  try {
    const ref = categoryCol.doc(categoryId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new Error("Category not found");
    }

    const updateData = {};

    // Update name if provided
    if (updates.name !== undefined) {
      // Check if name already exists (excluding current category)
      const existingName = await categoryCol
        .where("name", "==", updates.name)
        .limit(1)
        .get();
      
      if (!existingName.empty && existingName.docs[0].id !== categoryId) {
        throw new Error("Category with this name already exists");
      }
      updateData.name = updates.name;
    }

    // Update slug if provided
    if (updates.slug !== undefined) {
      // Check if slug already exists (excluding current category)
      const existingSlug = await categoryCol
        .where("slug", "==", updates.slug)
        .limit(1)
        .get();
      
      if (!existingSlug.empty && existingSlug.docs[0].id !== categoryId) {
        throw new Error("Category with this slug already exists");
      }
      updateData.slug = updates.slug;
    }

    // Update description if provided
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("No valid fields to update");
    }

    await ref.update(updateData);

    // Get updated document
    const updatedDoc = await ref.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };
  } catch (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }
}

/**
 * Delete a category (admin)
 * Prevents deletion if products are using this category
 */
async function deleteCategoryAdmin(categoryId) {
  try {
    const ref = categoryCol.doc(categoryId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new Error("Category not found");
    }

    // Check if any products are using this category
    const productsSnapshot = await productCol.where("categoryId", "==", categoryId).limit(1).get();
    if (!productsSnapshot.empty) {
      throw new Error("Cannot delete category: products are still using this category");
    }

    await ref.delete();

    return {
      success: true,
      message: "Category deleted successfully",
      deletedCategory: {
        id: categoryId,
        name: doc.data().name
      }
    };
  } catch (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
}

/**
 * Get category by ID
 */
async function getCategoryById(categoryId) {
  try {
    const doc = await categoryCol.doc(categoryId).get();
    if (!doc.exists) {
      throw new Error("Category not found");
    }
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    throw new Error(`Failed to get category: ${error.message}`);
  }
}

module.exports = {
  getAllCategoriesAdmin,
  createCategoryAdmin,
  updateCategoryAdmin,
  deleteCategoryAdmin,
  getCategoryById
};

