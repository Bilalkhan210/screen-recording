if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "H:/gradle-home/caches/8.11.1/transforms/60fb83dd73f2f6d4d50fd27176eec081/transformed/hermes-android-250829098.0.17-debug/prefab/modules/hermesvm/libs/android.x86/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "H:/gradle-home/caches/8.11.1/transforms/60fb83dd73f2f6d4d50fd27176eec081/transformed/hermes-android-250829098.0.17-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

