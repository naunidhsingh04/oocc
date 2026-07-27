#include "oocc_compiler/value.hpp"

#include <cmath>
#include <sstream>

namespace oocc {

std::string Value::to_display_string() const {
    if (is_bool()) return boolean ? "true" : "false";
    double n = number;
    if (std::isnan(n)) return "nan";
    if (std::isinf(n)) return n > 0 ? "inf" : "-inf";
    if (n == static_cast<long long>(n) && std::abs(n) < 1e15) {
        return std::to_string(static_cast<long long>(n));
    }
    std::ostringstream oss;
    oss.precision(15);
    oss << n;
    return oss.str();
}

}  // namespace oocc
