// OOCC C++ fixture: two-sum via a single pass with an unordered_map —
// exercises the unordered_map STL pretty-printer (oocc_stl_printers.hpp)
// end to end: inserts, a `.count()` lookup, and the returned index pair.
#include <iostream>
#include <unordered_map>
#include <vector>

std::vector<int> two_sum(std::vector<int>& nums, int target) {
    std::unordered_map<int, int> seen;
    for (int i = 0; i < static_cast<int>(nums.size()); i = i + 1) {
        int complement = target - nums[i];
        if (seen.count(complement) > 0) {
            std::vector<int> result;
            result.push_back(seen[complement]);
            result.push_back(i);
            return result;
        }
        seen[nums[i]] = i;
    }
    return std::vector<int>();
}

int main() {
    std::vector<int> nums;
    nums.push_back(2);
    nums.push_back(7);
    nums.push_back(11);
    nums.push_back(15);
    nums.push_back(3);
    int target = 9;

    std::vector<int> result = two_sum(nums, target);

    std::cout << "indices: [" << result[0] << ", " << result[1] << "]\n";

    return 0;
}
