// OOCC C++ fixture: binary search tree insertion — user-class heap
// instances with two outgoing pointer fields (left/right), exercising the
// same address-table/Describer<T> machinery as linked_list_reversal but
// with a branching (not linear) pointer structure, for the binary_tree
// panel built in Phase 2.
#include <iostream>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
};

TreeNode* insert(TreeNode* root, int val) {
    if (root == nullptr) {
        TreeNode* node = new TreeNode{val, nullptr, nullptr};
        return node;
    }
    if (val < root->val) {
        root->left = insert(root->left, val);
    } else {
        root->right = insert(root->right, val);
    }
    return root;
}

int main() {
    TreeNode* root = nullptr;
    root = insert(root, 8);
    root = insert(root, 3);
    root = insert(root, 10);
    root = insert(root, 1);
    root = insert(root, 6);
    root = insert(root, 14);

    std::cout << root->val << "\n";

    return 0;
}
