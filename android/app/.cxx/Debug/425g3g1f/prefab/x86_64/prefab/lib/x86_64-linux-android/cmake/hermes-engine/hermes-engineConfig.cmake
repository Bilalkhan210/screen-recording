if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/gradle-home/caches/8.9/transforms/9cafdd227da9a46ce75c1c94e19c60b5/transformed/jetified-hermes-android-250829098.0.17-debug/prefab/modules/hermesvm/libs/android.x86_64/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/gradle-home/caches/8.9/transforms/9cafdd227da9a46ce75c1c94e19c60b5/transformed/jetified-hermes-android-250829098.0.17-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

