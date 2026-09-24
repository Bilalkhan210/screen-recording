if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "H:/gradle-home/caches/8.11.1/transforms/284a8f36d39b644280ddc3ffa96efcc9/transformed/hermes-android-250829098.0.17-release/prefab/modules/hermesvm/libs/android.x86_64/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "H:/gradle-home/caches/8.11.1/transforms/284a8f36d39b644280ddc3ffa96efcc9/transformed/hermes-android-250829098.0.17-release/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

